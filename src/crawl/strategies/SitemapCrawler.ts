import Sitemapper from 'sitemapper'
import type { CrawledUrl } from '../Crawler.js'

export async function fetchSitemap(rootUrl: string): Promise<CrawledUrl[] | null> {
  const sitemapUrl = new URL('/sitemap.xml', rootUrl).toString()

  try {
    const sitemap = new Sitemapper({ url: sitemapUrl, timeout: 5000 })
    const { sites } = await sitemap.fetch()

    if (sites.length === 0) return null

    const rootOrigin = new URL(rootUrl).origin
    const filtered = sites.filter(url => {
      try { return new URL(url).origin === rootOrigin } catch { return false }
    })

    return filtered.map(url => ({ url, depth: getDepth(url) }))
  } catch {
    return null
  }
}

function getDepth(url: string): number {
  const path = new URL(url).pathname
  return path.split('/').filter(segment => segment.length > 0).length
}
