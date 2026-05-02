import { embed } from '../ollama/OllamaClient.js'
import { reason } from './TreeReasoner.js'
import { rerank } from './Reranker.js'
import { search, type SearchResult } from '../store/VectorStore.js'
import { loadTree, flattenTree, getDescendantIds } from '../tree/TreeSerializer.js'
import { urlToSourceId } from '../utils/sourceId.js'
import { getSource } from '../store/SourceRegistry.js'

const MAX_RETRIES = 2
const TOP_K = 10

export async function searchSource(
  query: string,
  sourceId: string
): Promise<SearchResult[]> {
  // load tree for this source
  const tree = loadTree(sourceId)
  if (!tree) throw new Error(`Source not found: ${sourceId}`)

  const nodeMap = flattenTree(tree)

  // embed query and run tree reasoning in parallel
  const [queryVector, nodeIds] = await Promise.all([
    embed(query),
    reason(sourceId, tree, query),
  ])

  // nodeIds is null if tree was too big — fall back to full-corpus search
  if (!nodeIds) {
    const results = await search(sourceId, queryVector, query, null, TOP_K)
    return rerank(query, results)
  }

  // expand selected node IDs to include all their descendants
  const expandedIds = getDescendantIds(nodeIds, nodeMap)

  let results = await search(sourceId, queryVector, query, expandedIds, TOP_K)
  let reranked = await rerank(query, results)
  let usedNodeIds = nodeIds
  let attempts = 1

  // retry loop — if reranker found nothing, try different nodes
  while (reranked.length === 0 && attempts < MAX_RETRIES) {
    attempts++
    const retryNodeIds = await reason(sourceId, tree, query, usedNodeIds)

    // if LLM can't suggest new nodes, fall back to full-corpus
    if (!retryNodeIds || retryNodeIds.length === 0) {
      results = await search(sourceId, queryVector, query, null, TOP_K)
      reranked = await rerank(query, results)
      break
    }

    usedNodeIds = [...usedNodeIds, ...retryNodeIds]
    const retryExpandedIds = getDescendantIds(retryNodeIds, nodeMap)
    results = await search(sourceId, queryVector, query, retryExpandedIds, TOP_K)
    reranked = await rerank(query, results)
  }

  return reranked
}

export async function searchAll(query: string): Promise<SearchResult[]> {
  const { listSources } = await import('../store/SourceRegistry.js')
  const sources = listSources()
  if (sources.length === 0) throw new Error('No sources indexed yet. Run: localdocs add <url>')

  const allResults = await Promise.all(
    sources.map(source => searchSource(query, source.id).catch(() => [] as SearchResult[]))
  )

  // merge and sort by score (lower distance = better match in LanceDB)
  return allResults.flat().sort((a, b) => a.score - b.score).slice(0, TOP_K)
}
