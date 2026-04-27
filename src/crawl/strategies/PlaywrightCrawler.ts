import { PlaywrightCrawler } from 'crawlee'
import type { CrawledUrl } from '../Crawler.js'

export async function crawlWithPlaywright(urls: string[], rootPath: string): Promise<CrawledUrl[]> {
  const found = new Map<string, number>()

  const crawler = new PlaywrightCrawler({
    maxConcurrency: 2,
    async requestHandler({ request, page }) {
      const url = request.loadedUrl ?? request.url
      await page.waitForLoadState('domcontentloaded')
      const text = await page.innerText('body')

      if (text.trim().length > 200) {
        found.set(url, getDepth(url, rootPath))
      }
    },
  })

  await crawler.run(urls)

  return Array.from(found.entries()).map(([url, depth]) => ({ url, depth }))
}

function getDepth(url: string, rootPath: string): number {
  const path = new URL(url).pathname
  const relative = path.slice(rootPath.length)
  return relative.split('/').filter(segment => segment.length > 0).length
}
