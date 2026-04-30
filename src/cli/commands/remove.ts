import type { Command } from 'commander'
import { deleteSource } from '../../store/VectorStore.js'
import { removeSource } from '../../store/SourceRegistry.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

export function registerRemove(program: Command): void {
  program
    .command('remove <sourceId>')
    .description('remove an indexed source and all its data')
    .action(async (sourceId: string) => {
      try {
        await deleteSource(sourceId)
        removeSource(sourceId)

        const treeDir = path.join(os.homedir(), '.localdocs', 'sources', sourceId)
        if (fs.existsSync(treeDir)) fs.rmSync(treeDir, { recursive: true })

        console.log(`✓ Removed ${sourceId}`)
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : err)
        process.exit(1)
      }
    })
}
