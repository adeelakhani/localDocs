import type { Command } from 'commander'
import { loadTree } from '../../tree/TreeSerializer.js'
import type { TreeNode } from '../../tree/TreeBuilder.js'

function printTree(nodes: TreeNode[], indent = 0): void {
  for (const node of nodes) {
    console.log(`${'  '.repeat(indent)}${node.text} [${node.id}]`)
    if (node.children.length > 0) printTree(node.children, indent + 1)
  }
}

export function registerTree(program: Command): void {
  program
    .command('tree <sourceId>')
    .description('show the section tree for a source')
    .action((sourceId: string) => {
      const tree = loadTree(sourceId)
      if (!tree) {
        console.error(`Source not found: ${sourceId}`)
        process.exit(1)
      }
      console.log(`\nSection tree for ${sourceId}:\n`)
      printTree(tree)
    })
}
