import fs from 'fs'
import path from 'path'
import os from 'os'
import type { TreeNode } from './TreeBuilder.js'

const BASE_DIR = path.join(os.homedir(), '.localdocs')

export function saveTree(sourceId: string, tree: TreeNode[]): void {
  const dir = path.join(BASE_DIR, 'sources', sourceId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'tree.json'), JSON.stringify(tree, null, 2))
}

export function loadTree(sourceId: string): TreeNode[] | null {
  const filePath = path.join(BASE_DIR, 'sources', sourceId, 'tree.json')
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TreeNode[]
}

export function flattenTree(tree: TreeNode[]): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>()
  function walk(nodes: TreeNode[]) {
    for (const node of nodes) {
      map.set(node.id, node)
      walk(node.children)
    }
  }
  walk(tree)
  return map
}
