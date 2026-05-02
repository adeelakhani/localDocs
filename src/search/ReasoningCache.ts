import fs from 'fs'
import path from 'path'
import os from 'os'
import { similarity } from 'ml-distance'
import { embed } from '../ollama/OllamaClient.js'

const BASE_DIR = path.join(os.homedir(), '.localdocs')
const SIMILARITY_THRESHOLD = 0.92
const MAX_ENTRIES = 500

interface CacheEntry {
  query: string
  embedding: number[]
  nodeIds: string[]
}

function cachePath(sourceId: string): string {
  return path.join(BASE_DIR, 'sources', sourceId, 'reasoning-cache.json')
}


function load(sourceId: string): CacheEntry[] {
  const p = cachePath(sourceId)
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as CacheEntry[] } catch { return [] }
}

function save(sourceId: string, entries: CacheEntry[]): void {
  fs.writeFileSync(cachePath(sourceId), JSON.stringify(entries))
}

export function clearCache(sourceId: string): void {
  const p = cachePath(sourceId)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

// check cache then run reasoning if missed — embeds query once, reuses for both
export async function withCache(
  sourceId: string,
  query: string,
  runReasoning: (queryEmbedding: number[]) => Promise<string[] | null>
): Promise<string[] | null> {
  const entries = load(sourceId)
  const queryEmbedding = await embed(query)

  // check for a similar cached query
  let bestScore = 0
  let bestMatch: CacheEntry | null = null
  for (const entry of entries) {
    const score = similarity.cosine(queryEmbedding, entry.embedding)
    if (score > bestScore) { bestScore = score; bestMatch = entry }
  }

  if (bestScore >= SIMILARITY_THRESHOLD && bestMatch) {
    return bestMatch.nodeIds
  }

  // cache miss — run LLM reasoning
  const nodeIds = await runReasoning(queryEmbedding)

  // save result if valid
  if (nodeIds && nodeIds.length > 0) {
    entries.push({ query, embedding: queryEmbedding, nodeIds })
    // evict oldest if over limit
    const trimmed = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries
    save(sourceId, trimmed)
  }

  return nodeIds
}
