import { chat } from '../ollama/OllamaClient.js'
import { TREE_REASONING_PROMPT } from './prompts.js'
import { withCache } from './ReasoningCache.js'
import type { TreeNode } from '../tree/TreeBuilder.js'

const FULL_TREE_THRESHOLD = 1000   // send full tree if total nodes < this
const LARGE_TREE_THRESHOLD = 5000  // if total nodes > this, skip reasoning entirely
const FALLBACK_DEPTH = 2           // depth limit used only when tree is large

// count navigable nodes (excludes heading leaves, which are chunking detail)
function countAllNodes(nodes: TreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (isHeadingNode(node)) continue
    count++
    count += countAllNodes(node.children)
  }
  return count
}

// heading nodes are tree leaves added per-page for chunking — they're not
// useful for LLM navigation and bloat the tree text massively, so skip them
function isHeadingNode(node: TreeNode): boolean {
  return node.url === null && node.children.length === 0
}

// format full tree as flat indented list, omitting heading nodes
function formatTree(nodes: TreeNode[], depth = 0): string {
  const lines: string[] = []
  for (const node of nodes) {
    if (isHeadingNode(node)) continue
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
    if (isHeadingNode(node)) continue
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
  sourceId: string,
  tree: TreeNode[],
  query: string,
  excludeNodeIds: string[] = []
): Promise<string[] | null> {
  const nodeCount = countAllNodes(tree)

  // site is massive — skip tree reasoning, search everything
  if (nodeCount > LARGE_TREE_THRESHOLD) return null

  // only cache initial attempts (not retries with excluded nodes)
  if (excludeNodeIds.length === 0) {
    return withCache(sourceId, query, () => runReasoning(tree, nodeCount, query, excludeNodeIds))
  }

  return runReasoning(tree, nodeCount, query, excludeNodeIds)
}

async function runReasoning(
  tree: TreeNode[],
  nodeCount: number,
  query: string,
  excludeNodeIds: string[]
): Promise<string[] | null> {
  const treeText = nodeCount <= FULL_TREE_THRESHOLD
    ? formatTree(tree)
    : formatTreeDepthLimited(tree)

  const excludeNote = excludeNodeIds.length > 0
    ? `\nThe following node IDs did NOT contain relevant results in a previous attempt, do not include them: ${JSON.stringify(excludeNodeIds)}`
    : ''

  const userMessage = `Documentation tree:\n${treeText}\n${excludeNote}\n\nQuery: ${query}`

  const response = await chat(
    TREE_REASONING_PROMPT,
    userMessage,
    { temperature: 0, num_predict: 100, num_ctx: 32768 },
    {
      type: 'array',
      items: { type: 'string', pattern: '^[a-f0-9]{12}$' },
      minItems: 1,
      maxItems: 10,
    }
  )
  return parseNodeIds(response)
}
