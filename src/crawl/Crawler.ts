import { fetchSitemap } from './strategies/SitemapCrawler.js'
import { crawlWithCheerio } from './strategies/CheerioCrawler.js'
import { crawlWithPlaywright } from './strategies/PlaywrightCrawler.js'

export interface CrawledUrl {
  url: string
  depth: number
}

export async function crawl(rootUrl: string): Promise<CrawledUrl[]> {
  // 1. try sitemap first
  console.log(`Checking sitemap...`)
  const sitemapResults = await fetchSitemap(rootUrl)
  if (sitemapResults) {
    console.log(`✓ Sitemap found — ${sitemapResults.length} URLs`)
    return sitemapResults
  }

  // 2. fall back to CheerioCrawler
  console.log(`No sitemap — crawling with CheerioCrawler...`)
  const { urls: cheerioResults, jsFlaggedUrls } = await crawlWithCheerio(rootUrl)
  console.log(`✓ CheerioCrawler found — ${cheerioResults.length} URLs`)

  // 3. re-fetch JS-rendered pages with Playwright
  if (jsFlaggedUrls.length > 0) {
    console.log(`Re-fetching ${jsFlaggedUrls.length} JS-rendered pages with Playwright...`)
    const playwrightResults = await crawlWithPlaywright(jsFlaggedUrls)
    console.log(`✓ Playwright found — ${playwrightResults.length} URLs`)
    return [...cheerioResults, ...playwrightResults]
  }

  return cheerioResults
}

// --- test ---
const rootUrl = 'https://codepen.io'
console.log(`Crawling ${rootUrl}\n`)

const results = await crawl(rootUrl)

console.log(`\nTotal: ${results.length} URLs\n`)
results.slice(0, 20).forEach(({ url, depth }) => {
  const indent = '  '.repeat(depth)
  console.log(`${indent}[depth ${depth}] ${url}`)
})
