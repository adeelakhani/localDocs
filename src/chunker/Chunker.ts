import { createHash } from 'crypto'
import * as cheerio from 'cheerio'
import type { PageData } from '../tree/TreeBuilder.js'
import type { TreeNode } from '../tree/TreeBuilder.js'

export interface Chunk {
  id: string
  sourceId: string
  treeNodeId: string
  treePath: string
  url: string
  pageTitle: string
  headingLevel: number
  text: string
}

const MAX_TOKENS = 500

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function isInsideCodeBlock(text: string): boolean {
  return ((text.match(/```/g) ?? []).length) % 2 !== 0
}

function chunkId(sourceId: string, treeNodeId: string, index: number): string {
  return createHash('sha1').update(sourceId + ':' + treeNodeId + ':' + index).digest('hex').slice(0, 12)
}

// split a long section into smaller chunks at paragraph boundaries
// never cut inside a code block
function splitLongSection(text: string): string[] {
  if (estimateTokens(text) <= MAX_TOKENS) return [text]

  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let current: string[] = []
  let overlap = ''

  for (const para of paragraphs) {
    current.push(para)
    const candidate = [overlap, ...current].filter(Boolean).join('\n\n')

    if (estimateTokens(candidate) > MAX_TOKENS && current.length > 1) {
      current.pop()
      const chunkText = [overlap, ...current].filter(Boolean).join('\n\n').trim()
      if (!isInsideCodeBlock(chunkText)) {
        chunks.push(chunkText)
        overlap = current.at(-1) ?? ''
        current = [para]
      } else {
        current.push(para)
      }
    }
  }

  if (current.length > 0) {
    const chunkText = [overlap, ...current].filter(Boolean).join('\n\n').trim()
    if (chunkText) chunks.push(chunkText)
  }

  return chunks.filter(c => c.length > 0)
}

// split HTML content into sections at heading boundaries using Cheerio
function splitHtmlIntoSections(
  htmlContent: string,
  headingTexts: Set<string>
): { heading: string | null; level: number; text: string }[] {
  const $ = cheerio.load(htmlContent)

  type Item = { type: 'heading'; text: string; level: number } | { type: 'text'; text: string }

  // Recursively walk the DOM: headings become split points, container elements
  // (section/article/div) are transparent, everything else yields its text.
  function walk(el: any): Item[] {
    const tag = (el.tagName ?? '').toLowerCase()

    if (['h1', 'h2', 'h3', 'h4', 'h5'].includes(tag)) {
      const raw = $(el).text().trim().replace(/\s*#$/, '')
      if (headingTexts.has(raw)) {
        return [{ type: 'heading', text: raw, level: parseInt(tag.slice(1)) }]
      }
    }

    if (['section', 'article', 'div', 'main', 'header', 'footer'].includes(tag) || !tag) {
      return $(el).children().toArray().flatMap(walk)
    }

    const text = $(el).text().trim()
    return text ? [{ type: 'text', text }] : []
  }

  const items: Item[] = $('body').children().toArray().flatMap(walk)

  const sections: { heading: string | null; level: number; text: string }[] = []
  let currentHeading: string | null = null
  let currentLevel = 1
  let currentParts: string[] = []

  for (const item of items) {
    if (item.type === 'heading') {
      if (currentParts.length > 0) {
        sections.push({ heading: currentHeading, level: currentLevel, text: currentParts.join('\n\n').trim() })
      }
      currentHeading = item.text
      currentLevel = item.level
      currentParts = []
    } else {
      currentParts.push(item.text)
    }
  }

  if (currentParts.length > 0) {
    sections.push({ heading: currentHeading, level: currentLevel, text: currentParts.join('\n\n').trim() })
  }

  return sections
}

export function chunkPage(
  page: PageData,
  sourceId: string,
  nodeMap: Map<string, TreeNode>
): Chunk[] {
  // find this page's node in the tree by URL
  let pageNode: TreeNode | undefined
  for (const node of nodeMap.values()) {
    if (node.url === page.url) { pageNode = node; break }
  }
  if (!pageNode) return []

  // map heading text → child node for quick lookup
  const headingToNode = new Map<string, TreeNode>()
  for (const child of pageNode.children) {
    headingToNode.set(child.text, child)
  }

  const headingTexts = new Set(page.headings.map(h => h.text))

  // use HTML splitting if available, fall back to plain text
  let sections: { heading: string | null; level: number; text: string }[]

  if (page.htmlContent) {
    sections = splitHtmlIntoSections(page.htmlContent, headingTexts)
  } else {
    // plain text fallback — split by lines matching heading texts
    const lines = page.content.split('\n')
    const rawSections: { heading: string | null; level: number; lines: string[] }[] = []
    let currentHeading: string | null = null
    let currentLevel = 1
    let currentLines: string[] = []

    for (const line of lines) {
      const trimmed = line.trim().replace(/\s*#$/, '')
      if (headingTexts.has(trimmed)) {
        if (currentLines.length > 0) rawSections.push({ heading: currentHeading, level: currentLevel, lines: currentLines })
        const h = page.headings.find(h => h.text === trimmed)
        currentHeading = trimmed
        currentLevel = h?.level ?? 2
        currentLines = [line]
      } else {
        currentLines.push(line)
      }
    }
    if (currentLines.length > 0) rawSections.push({ heading: currentHeading, level: currentLevel, lines: currentLines })
    sections = rawSections.map(s => ({ heading: s.heading, level: s.level, text: s.lines.join('\n').trim() }))
  }

  // turn sections into chunks tagged with tree node IDs
  const chunks: Chunk[] = []

  for (const section of sections) {
    const text = section.text
    if (!text) continue

    const treeNode = section.heading === null
      ? pageNode
      : (headingToNode.get(section.heading) ?? pageNode)

    for (const subText of splitLongSection(text)) {
      chunks.push({
        id: chunkId(sourceId, treeNode.id, chunks.length),
        sourceId,
        treeNodeId: treeNode.id,
        treePath: treeNode.treePath,
        url: page.url,
        pageTitle: page.title,
        headingLevel: section.level,
        text: subText,
      })
    }
  }

  return chunks
}
