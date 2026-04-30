import type { Command } from 'commander'
import { checkHealth } from '../../ollama/OllamaClient.js'

export function registerCheck(program: Command): void {
  program
    .command('check')
    .description('check Ollama is running and models are available')
    .action(async () => {
      try {
        await checkHealth()
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : err)
        process.exit(1)
      }
    })
}
