import { CheerioCrawler, log } from 'crawlee'
import type { CrawledUrl } from '../Crawler.js'

log.setLevel(log.LEVELS.OFF)

interface CheerioCrawlResult {
  urls: CrawledUrl[]
  jsFlaggedUrls: string[]
}

export async function crawlWithCheerio(rootUrl: string): Promise<CheerioCrawlResult> {
  const found = new Map<string, number>()
  const jsFlagged: string[] = []

  const rootParsed = new URL(rootUrl)
  const rootOrigin = rootParsed.origin
  const rootPath = rootParsed.pathname.replace(/\/$/, '')

  const crawler = new CheerioCrawler({
    maxConcurrency: 5,
    maxRequestsPerCrawl: 500,
    async requestHandler({ request, $, enqueueLinks }) {
      const url = request.loadedUrl ?? request.url
      const parsed = new URL(url)
      if (parsed.origin !== rootOrigin) return
      if (!parsed.pathname.startsWith(rootPath === '' ? '/' : rootPath)) return

      const appShell = $('[id="root"], [id="__next"], [id="app"], [id="__nuxt"]')
      const isJsRendered = appShell.length > 0 && appShell.text().trim().length === 0

      if (isJsRendered) {
        console.error(`  [js] ${url}`)
        jsFlagged.push(url)
        return
      }

      found.set(url, getDepth(url, rootPath))
      await enqueueLinks({
        strategy: 'same-origin',
        transformRequestFunction: req => {
          try {
            const u = new URL(req.url)
            if (!u.pathname.startsWith(rootPath === '' ? '/' : rootPath)) return false
          } catch { return false }
          return req
        },
      })
    },
  })

  await crawler.run([rootUrl])

  return {
    urls: Array.from(found.entries()).map(([url, depth]) => ({ url, depth })),
    jsFlaggedUrls: jsFlagged,
  }
}

function getDepth(url: string, rootPath: string): number {
  const path = new URL(url).pathname
  const relative = path.slice(rootPath.length)
  return relative.split('/').filter(segment => segment.length > 0).length
}
