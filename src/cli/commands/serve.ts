import type { Command } from 'commander'

export function registerServe(program: Command): void {
  program
    .command('serve')
    .description('start the MCP server')
    .action(() => {
      console.error('MCP server not yet implemented.')
      process.exit(1)
    })
}
