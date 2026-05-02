import { fetchSitemap } from './strategies/SitemapCrawler.js'
import { crawlWithCheerio } from './strategies/CheerioCrawler.js'
import { crawlWithPlaywright } from './strategies/PlaywrightCrawler.js'

export interface CrawledUrl {
  url: string
  depth: number
  html?: string  // pre-rendered HTML from Playwright; skip re-fetch in Indexer if present
}

export async function crawl(rootUrl: string): Promise<CrawledUrl[]> {
  const rootPath = new URL(rootUrl).pathname.replace(/\/$/, '')

  // 1. try sitemap first
  console.error(`Checking sitemap...`)
  const sitemapResults = await fetchSitemap(rootUrl)
  if (sitemapResults) {
    console.error(`✓ Sitemap found — ${sitemapResults.length} URLs`)
    return sitemapResults
  }

  // 2. fall back to CheerioCrawler
  console.error(`No sitemap — crawling with CheerioCrawler...`)
  const { urls: cheerioResults, jsFlaggedUrls } = await crawlWithCheerio(rootUrl)
  console.error(`✓ CheerioCrawler found — ${cheerioResults.length} URLs`)

  // 3. re-fetch JS-rendered pages with Playwright
  if (jsFlaggedUrls.length > 0) {
    console.error(`Re-fetching ${jsFlaggedUrls.length} JS-rendered pages with Playwright...`)
    const playwrightResults = await crawlWithPlaywright(jsFlaggedUrls, rootPath)
    console.error(`✓ Playwright found — ${playwrightResults.length} URLs`)
    return [...cheerioResults, ...playwrightResults]
  }

  return cheerioResults
}
