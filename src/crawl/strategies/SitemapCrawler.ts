import Sitemapper from 'sitemapper'
import type { CrawledUrl } from '../Crawler.js'

export async function fetchSitemap(rootUrl: string): Promise<CrawledUrl[] | null> {
  const sitemapUrl = new URL('/sitemap.xml', rootUrl).toString()

  try {
    const sitemap = new Sitemapper({ url: sitemapUrl, timeout: 5000 })
    const { sites } = await sitemap.fetch()

    if (sites.length === 0) return null

    const rootParsed = new URL(rootUrl)
    const rootOrigin = rootParsed.origin
    const rootPath = rootParsed.pathname.replace(/\/$/, '')

    const filtered = sites.filter(url => {
      try {
        const u = new URL(url)
        return u.origin === rootOrigin && u.pathname.startsWith(rootPath === '' ? '/' : rootPath)
      } catch { return false }
    })

    return filtered.map(url => ({ url, depth: getDepth(url, rootPath) }))
  } catch {
    return null
  }
}

function getDepth(url: string, rootPath: string): number {
  const path = new URL(url).pathname
  const relative = path.slice(rootPath.length)
  return relative.split('/').filter(segment => segment.length > 0).length
}
