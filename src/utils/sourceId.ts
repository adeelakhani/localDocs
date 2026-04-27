export function urlToSourceId(url: string): string {
  const { hostname, pathname } = new URL(url)
  return (hostname + pathname)
    .replace(/\./g, '-')
    .replace(/\//g, '-')
    .replace(/-+$/, '')
    .replace(/-{2,}/g, '-')
}
