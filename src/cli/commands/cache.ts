import type { Command } from 'commander'
import { clearCache } from '../../search/ReasoningCache.js'
import { listSources, getSource } from '../../store/SourceRegistry.js'
import path from 'path'
import os from 'os'
import fs from 'fs'

export function registerCache(program: Command): void {
  const cache = program
    .command('cache')
    .description('manage the reasoning cache')

  cache
    .command('clear [sourceId]')
    .description('clear reasoning cache for a source, or all sources if no sourceId given')
    .action((sourceId?: string) => {
      if (sourceId) {
        const source = getSource(sourceId)
        if (!source) {
          console.error(`Source not found: ${sourceId}`)
          process.exit(1)
        }
        clearCache(sourceId)
        console.log(`✓ Cleared cache for ${sourceId}`)
      } else {
        const sources = listSources()
        if (sources.length === 0) {
          console.log('No sources indexed.')
          return
        }
        for (const source of sources) {
          clearCache(source.id)
        }
        console.log(`✓ Cleared cache for ${sources.length} source(s)`)
      }
    })

  cache
    .command('stats [sourceId]')
    .description('show cache entry count for a source, or all sources')
    .action((sourceId?: string) => {
      const sources = sourceId ? [getSource(sourceId)].filter(Boolean) : listSources()
      if (sources.length === 0) {
        console.log(sourceId ? `Source not found: ${sourceId}` : 'No sources indexed.')
        return
      }
      for (const source of sources) {
        const cacheFile = path.join(os.homedir(), '.localdocs', 'sources', source!.id, 'reasoning-cache.json')
        if (!fs.existsSync(cacheFile)) {
          console.log(`  ${source!.id}: 0 entries`)
          continue
        }
        try {
          const entries = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
          console.log(`  ${source!.id}: ${entries.length} entries`)
        } catch {
          console.log(`  ${source!.id}: (unreadable)`)
        }
      }
    })
}
