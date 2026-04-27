import { fetchSitemap } from './strategies/SitemapCrawler.js'
import { crawlWithCheerio } from './strategies/CheerioCrawler.js'
import { crawlWithPlaywright } from './strategies/PlaywrightCrawler.js'

export interface CrawledUrl {
  url: string
  depth: number
}

export async function crawl(rootUrl: string): Promise<CrawledUrl[]> {
  const rootPath = new URL(rootUrl).pathname.replace(/\/$/, '')

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
    const playwrightResults = await crawlWithPlaywright(jsFlaggedUrls, rootPath)
    console.log(`✓ Playwright found — ${playwrightResults.length} URLs`)
    return [...cheerioResults, ...playwrightResults]
  }

  return cheerioResults
}
