import { chat } from '../ollama/OllamaClient.js'
import { RERANKER_PROMPT } from './prompts.js'
import type { SearchResult } from '../store/VectorStore.js'

function parseChunkIds(response: string): string[] | null {
  try {
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

export async function rerank(query: string, results: SearchResult[]): Promise<SearchResult[]> {
  if (results.length === 0) return []

  const chunksText = results
    .map(r => `[${r.id}] ${r.text.slice(0, 300)}`)
    .join('\n\n')

  const userMessage = `Query: ${query}\n\nChunks:\n${chunksText}`

  const response = await chat(RERANKER_PROMPT, userMessage)
  const relevantIds = parseChunkIds(response)

  // if LLM response is unparseable, return original results unfiltered
  if (!relevantIds) return results

  // if LLM says nothing is relevant, return empty
  if (relevantIds.length === 0) return []

  // filter to only the chunks the LLM said are relevant, preserving original order
  return results.filter(r => relevantIds.includes(r.id))
}
