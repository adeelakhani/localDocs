import type { Command } from 'commander'
import { searchSource, searchAll } from '../../search/Searcher.js'

export function registerSearch(program: Command): void {
  program
    .command('search <query>')
    .description('search indexed documentation')
    .option('-s, --source <sourceId>', 'search a specific source')
    .action(async (query: string, options: { source?: string }) => {
      try {
        const results = options.source
          ? await searchSource(query, options.source)
          : await searchAll(query)

        if (results.length === 0) {
          console.log('No results found.')
          return
        }

        results.forEach((r, i) => {
          console.log(`\n${i + 1}. [${r.treePath}]`)
          console.log(`   ${r.url}`)
          console.log(`   ${r.text.slice(0, 200).replace(/\n/g, ' ')}`)
        })
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : err)
        process.exit(1)
      }
    })
}
