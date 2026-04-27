import { createHash } from 'crypto'
import type { ExtractedPage } from '../crawl/Extractor.js'

export interface TreeNode {
  id: string
  text: string
  treePath: string
  url: string | null
  children: TreeNode[]
}

export interface PageData extends ExtractedPage {
  url: string
  depth: number
}

function nodeId(sourceId: string, path: string): string {
  return createHash('sha1').update(sourceId + ':' + path).digest('hex').slice(0, 12)
}

function humanize(segment: string): string {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function buildTree(pages: PageData[], sourceId: string): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  function getOrCreateContainer(segments: string[], index: number): TreeNode {
    const pathKey = segments.slice(0, index + 1).join('/')

    if (nodeMap.has(pathKey)) return nodeMap.get(pathKey)!

    const text = humanize(segments[index]!)
    const treePath = segments.slice(0, index + 1).map(s => humanize(s)).join(' > ')

    const node: TreeNode = {
      id: nodeId(sourceId, pathKey),
      text,
      treePath,
      url: null,
      children: [],
    }

    nodeMap.set(pathKey, node)

    if (index === 0) {
      roots.push(node)
    } else {
      const parentPath = segments.slice(0, index).join('/')
      nodeMap.get(parentPath)!.children.push(node)
    }

    return node
  }

  for (const page of pages) {
    const segments = new URL(page.url).pathname.split('/').filter(s => s.length > 0)
    if (segments.length === 0) continue

    for (let i = 0; i < segments.length - 1; i++) {
      getOrCreateContainer(segments, i)
    }

    const pathKey = segments.join('/')
    const leafSegment = segments.at(-1)
    if (!leafSegment) continue
    const existing = nodeMap.get(pathKey)

    const pageTreePath = segments.map(s => humanize(s)).join(' > ')

    const headingChildren: TreeNode[] = page.headings.map((h, i) => ({
      id: nodeId(sourceId, pathKey + ':' + i + ':' + h.text),
      text: h.text,
      treePath: pageTreePath + ' > ' + h.text,
      url: null,
      children: [],
    }))

    if (existing) {
      existing.url = page.url
      existing.children = headingChildren
    } else {
      const leafNode: TreeNode = {
        id: nodeId(sourceId, pathKey),
        text: humanize(leafSegment),
        treePath: pageTreePath,
        url: page.url,
        children: headingChildren,
      }

      nodeMap.set(pathKey, leafNode)

      if (segments.length === 1) {
        roots.push(leafNode)
      } else {
        const parentPath = segments.slice(0, -1).join('/')
        nodeMap.get(parentPath)!.children.push(leafNode)
      }
    }
  }

  return roots
}
