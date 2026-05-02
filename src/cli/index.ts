#!/usr/bin/env node
import { Command } from 'commander'
import { createRequire } from 'module'
const { version } = createRequire(import.meta.url)('../../package.json') as { version: string }
import { registerAdd } from './commands/add.js'
import { registerSearch } from './commands/search.js'
import { registerList } from './commands/list.js'
import { registerTree } from './commands/tree.js'
import { registerRemove } from './commands/remove.js'
import { registerCheck } from './commands/check.js'
import { registerConfig } from './commands/config.js'
import { registerServe } from './commands/serve.js'
import { registerCache } from './commands/cache.js'

const program = new Command()

program
  .name('localdocs')
  .description('Local-first documentation indexer and search')
  .version(version)

registerAdd(program)
registerSearch(program)
registerList(program)
registerTree(program)
registerRemove(program)
registerCheck(program)
registerConfig(program)
registerServe(program)
registerCache(program)

program.parse(process.argv)
