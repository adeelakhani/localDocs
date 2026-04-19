import { CheerioCrawler } from 'crawlee'
import type { CrawledUrl } from '../Crawler.js'

interface CheerioCrawlResult {
  urls: CrawledUrl[]
  jsFlaggedUrls: string[]
}

export async function crawlWithCheerio(rootUrl: string): Promise<CheerioCrawlResult> {
  const found = new Map<string, number>()
  const jsFlagged: string[] = []

  const crawler = new CheerioCrawler({
    maxConcurrency: 5,
    maxRequestsPerCrawl: 500,
    async requestHandler({ request, $, enqueueLinks }) {
      const url = request.loadedUrl ?? request.url

      const appShell = $('[id="root"], [id="__next"], [id="app"], [id="__nuxt"]')
      const isJsRendered = appShell.length > 0 && appShell.text().trim().length === 0

      if (isJsRendered) {
        console.log(`  [js] ${url}`)
        jsFlagged.push(url)
        return
      }

      found.set(url, getDepth(url))
      await enqueueLinks({ strategy: 'same-origin' })
    },
  })

  await crawler.run([rootUrl])

  return {
    urls: Array.from(found.entries()).map(([url, depth]) => ({ url, depth })),
    jsFlaggedUrls: jsFlagged,
  }
}

function getDepth(url: string): number {
  const path = new URL(url).pathname
  return path.split('/').filter(segment => segment.length > 0).length
}
