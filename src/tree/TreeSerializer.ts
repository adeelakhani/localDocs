import fs from 'fs'
import path from 'path'
import os from 'os'
import type { TreeNode } from './TreeBuilder.js'
import { clearCache } from '../search/ReasoningCache.js'

const BASE_DIR = path.join(os.homedir(), '.localdocs')

export function saveTree(sourceId: string, tree: TreeNode[]): void {
  const dir = path.join(BASE_DIR, 'sources', sourceId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'tree.json'), JSON.stringify(tree, null, 2))
  clearCache(sourceId)  // tree changed — old reasoning results are stale
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

// given a set of node IDs, return those IDs plus all their descendants
// so picking "Developers > Api" also includes "Developers > Api > Webhooks" etc
export function getDescendantIds(nodeIds: string[], nodeMap: Map<string, TreeNode>): string[] {
  const result = new Set<string>()
  function walk(id: string) {
    const node = nodeMap.get(id)
    if (!node) return
    result.add(id)
    for (const child of node.children) {
      walk(child.id)
    }
  }
  for (const id of nodeIds) {
    walk(id)
  }
  return Array.from(result)
}
