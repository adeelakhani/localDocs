import { chat } from '../ollama/OllamaClient.js'
import { TREE_REASONING_PROMPT } from './prompts.js'
import type { TreeNode } from '../tree/TreeBuilder.js'

const FULL_TREE_THRESHOLD = 1000   // send full tree if total nodes < this
const LARGE_TREE_THRESHOLD = 5000  // if total nodes > this, skip reasoning entirely
const FALLBACK_DEPTH = 2           // depth limit used only when tree is large

// count all nodes in the tree regardless of depth
function countAllNodes(nodes: TreeNode[]): number {
  let count = nodes.length
  for (const node of nodes) {
    count += countAllNodes(node.children)
  }
  return count
}

// format full tree as flat indented list
function formatTree(nodes: TreeNode[], depth = 0): string {
  const lines: string[] = []
  for (const node of nodes) {
    lines.push(`${'  '.repeat(depth)}[${node.id}] ${node.treePath}`)
    const childLines = formatTree(node.children, depth + 1)
    if (childLines) lines.push(childLines)
  }
  return lines.join('\n')
}

// format tree limited to top N levels — used for large sites
function formatTreeDepthLimited(nodes: TreeNode[], depth = 0): string {
  if (depth >= FALLBACK_DEPTH) return ''
  const lines: string[] = []
  for (const node of nodes) {
    lines.push(`${'  '.repeat(depth)}[${node.id}] ${node.treePath}`)
    const childLines = formatTreeDepthLimited(node.children, depth + 1)
    if (childLines) lines.push(childLines)
  }
  return lines.join('\n')
}

function parseNodeIds(response: string): string[] | null {
  try {
    // strip any markdown code fences the LLM might add
    const cleaned = response.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.every(id => typeof id === 'string')) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export async function reason(
  tree: TreeNode[],
  query: string,
  excludeNodeIds: string[] = []
): Promise<string[] | null> {
  const nodeCount = countAllNodes(tree)

  // site is massive — skip tree reasoning, search everything
  if (nodeCount > LARGE_TREE_THRESHOLD) return null

  // small site — send full tree for maximum precision
  // large site — send top 2 levels only to stay within context window
  const treeText = nodeCount <= FULL_TREE_THRESHOLD
    ? formatTree(tree)
    : formatTreeDepthLimited(tree)

  const excludeNote = excludeNodeIds.length > 0
    ? `\nThe following node IDs did NOT contain relevant results in a previous attempt, do not include them: ${JSON.stringify(excludeNodeIds)}`
    : ''

  const userMessage = `Documentation tree:\n${treeText}\n${excludeNote}\n\nQuery: ${query}`

  const response = await chat(TREE_REASONING_PROMPT, userMessage)
  return parseNodeIds(response)
}
