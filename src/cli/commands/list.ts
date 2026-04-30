import type { Command } from 'commander'
import { listSources } from '../../store/SourceRegistry.js'

export function registerList(program: Command): void {
  program
    .command('list')
    .description('list all indexed sources')
    .action(() => {
      const sources = listSources()

      if (sources.length === 0) {
        console.log('No sources indexed yet. Run: localdocs add <url>')
        return
      }

      console.log(`\n${sources.length} source(s) indexed:\n`)
      sources.forEach(s => {
        console.log(`  ${s.id}`)
        console.log(`    url:     ${s.url}`)
        console.log(`    chunks:  ${s.chunkCount}`)
        console.log(`    indexed: ${new Date(s.indexedAt).toLocaleString()}`)
        console.log()
      })
    })
}
