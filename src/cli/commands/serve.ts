import type { Command } from 'commander'
import { startServer } from '../../mcp/server.js'

export function registerServe(program: Command): void {
  program
    .command('serve')
    .description('start the MCP server')
    .action(async () => {
      await startServer()
    })
}
