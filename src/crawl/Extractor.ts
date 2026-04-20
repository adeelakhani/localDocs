import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import * as cheerio from 'cheerio'

export interface Heading {
  level: number
  text: string
}

export interface ExtractedPage {
  title: string
  content: string
  headings: Heading[]
}

export function extractPage(html: string, url: string): ExtractedPage | null {
  const headings = extractHeadings(html)

  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()

  if (article) {
    const text = (article.textContent ?? '').trim()
    if (text.length > 0) {
      return {
        title: article.title ?? '',
        content: cleanContent(text),
        headings,
      }
    }
  }

  // fallback: Cheerio grabs <main>, <article>, or <body>
  const $ = cheerio.load(html)
  const content = cleanContent(
    $('main').text().trim() ||
    $('article').text().trim() ||
    $('body').text().trim()
  )

  const title = $('title').text().trim() || $('h1').first().text().trim()

  if (!content) return null

  return { title, content, headings }
}

function extractHeadings(html: string): Heading[] {
  const $ = cheerio.load(html)
  const headings: Heading[] = []

  $('h1, h2, h3').each((_, el) => {
    const level = parseInt(el.tagName.replace('h', ''))
    const raw = $(el).text().trim()

    // drop headings containing newlines — these are always logos or nav elements, not real headings
    if (raw.includes('\n')) return

    // strip trailing anchor link symbol
    const text = raw.replace(/\s*#$/, '')

    if (text) headings.push({ level, text })
  })

  return headings
}

function cleanContent(content: string): string {
  // strip known UI strings that appear at the very start of content
  return content.replace(/^Read as Markdown\s*/i, '').trim()
}
