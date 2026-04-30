#!/usr/bin/env node
import { Command } from 'commander'
import { registerAdd } from './commands/add.js'
import { registerSearch } from './commands/search.js'
import { registerList } from './commands/list.js'
import { registerTree } from './commands/tree.js'
import { registerRemove } from './commands/remove.js'
import { registerCheck } from './commands/check.js'
import { registerConfig } from './commands/config.js'
import { registerServe } from './commands/serve.js'

const program = new Command()

program
  .name('localdocs')
  .description('Local-first documentation indexer and search')
  .version('1.0.0')

registerAdd(program)
registerSearch(program)
registerList(program)
registerTree(program)
registerRemove(program)
registerCheck(program)
registerConfig(program)
registerServe(program)

program.parse(process.argv)
