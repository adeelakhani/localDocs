import type { Command } from 'commander'
import { run as indexerRun } from '../../indexer/Indexer.js'

export function registerAdd(program: Command): void {
  program
    .command('add <url>')
    .description('crawl and index a documentation site')
    .action(async (url: string) => {
      try {
        await indexerRun(url)
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : err)
        process.exit(1)
      }
    })
}
