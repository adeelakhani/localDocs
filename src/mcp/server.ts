import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { searchSource, searchAll } from '../search/Searcher.js'
import { run as indexerRun } from '../indexer/Indexer.js'
import { listSources, getSource, removeSource } from '../store/SourceRegistry.js'
import { deleteSource } from '../store/VectorStore.js'
import { loadTree } from '../tree/TreeSerializer.js'
import { checkHealth } from '../ollama/OllamaClient.js'
import { clearCache } from '../search/ReasoningCache.js'
import type { TreeNode } from '../tree/TreeBuilder.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

function formatTree(nodes: TreeNode[], indent = 0): string {
  return nodes.map(node => {
    const line = `${'  '.repeat(indent)}${node.text} [${node.id}]`
    const children = node.children.length > 0 ? '\n' + formatTree(node.children, indent + 1) : ''
    return line + children
  }).join('\n')
}

export async function startServer(): Promise<void> {
  const server = new McpServer({ name: 'localdocs', version: '1.0.0' })

  server.tool(
    'search',
    'Search indexed documentation using natural language. Runs hybrid vector + BM25 search scoped to relevant tree sections.',
    {
      query: z.string().describe('Natural language search query'),
      sourceId: z.string().optional().describe('Search a specific source. If omitted, searches all sources.'),
    },
    async ({ query, sourceId }) => {
      const results = sourceId
        ? await searchSource(query, sourceId)
        : await searchAll(query)

      if (results.length === 0) {
        return { content: [{ type: 'text', text: 'No results found.' }] }
      }

      const text = results.map((r, i) =>
        `${i + 1}. [${r.treePath}]\n   ${r.url}\n   ${r.text.slice(0, 300).replace(/\n/g, ' ')}`
      ).join('\n\n')

      return { content: [{ type: 'text', text }] }
    }
  )

  server.tool(
    'add',
    'Crawl and index a documentation website.',
    { url: z.string().describe('URL of the documentation site to index') },
    async ({ url }) => {
      await indexerRun(url)
      return { content: [{ type: 'text', text: `✓ Successfully indexed ${url}` }] }
    }
  )

  server.tool(
    'list',
    'List all indexed documentation sources.',
    {},
    async () => {
      const sources = listSources()
      if (sources.length === 0) {
        return { content: [{ type: 'text', text: 'No sources indexed yet.' }] }
      }
      const text = sources.map(s =>
        `${s.id}\n  url: ${s.url}\n  chunks: ${s.chunkCount}\n  indexed: ${new Date(s.indexedAt).toLocaleString()}`
      ).join('\n\n')
      return { content: [{ type: 'text', text }] }
    }
  )

  server.tool(
    'tree',
    'Show the section tree for an indexed source.',
    { sourceId: z.string().describe('The source ID to show the tree for') },
    async ({ sourceId }) => {
      const tree = loadTree(sourceId)
      if (!tree) {
        return { content: [{ type: 'text', text: `Source not found: ${sourceId}` }] }
      }
      if (tree.length === 0) {
        return { content: [{ type: 'text', text: `No tree data available for ${sourceId}.` }] }
      }
      return { content: [{ type: 'text', text: formatTree(tree) }] }
    }
  )

  server.tool(
    'remove',
    'Remove an indexed source and all its data.',
    { sourceId: z.string().describe('The source ID to remove') },
    async ({ sourceId }) => {
      const source = getSource(sourceId)
      if (!source) {
        return { content: [{ type: 'text', text: `Source not found: ${sourceId}` }], isError: true }
      }
      await deleteSource(sourceId)
      removeSource(sourceId)
      const treeDir = path.join(os.homedir(), '.localdocs', 'sources', sourceId)
      if (fs.existsSync(treeDir)) fs.rmSync(treeDir, { recursive: true })
      return { content: [{ type: 'text', text: `✓ Removed ${sourceId}` }] }
    }
  )

  server.tool(
    'check',
    'Check that Ollama is running and required models are available.',
    {},
    async () => {
      await checkHealth()
      return { content: [{ type: 'text', text: '✓ Ollama is running and models are available.' }] }
    }
  )

  server.tool(
    'clear_cache',
    'Clear the reasoning cache for a source or all sources. Useful if search results feel stale or you want to force fresh LLM tree reasoning.',
    { sourceId: z.string().optional().describe('Source ID to clear. If omitted, clears cache for all sources.') },
    async ({ sourceId }) => {
      const sources = listSources()
      if (sourceId) {
        const source = getSource(sourceId)
        if (!source) {
          return { content: [{ type: 'text', text: `Source not found: ${sourceId}` }], isError: true }
        }
        clearCache(sourceId)
        return { content: [{ type: 'text', text: `✓ Cleared cache for ${sourceId}` }] }
      }
      for (const source of sources) clearCache(source.id)
      return { content: [{ type: 'text', text: `✓ Cleared cache for ${sources.length} source(s)` }] }
    }
  )

  server.tool(
    'tips',
    'Get tips and best practices for using localdocs effectively as an agent.',
    {},
    async () => {
      const text = `# localdocs — Agent Usage Tips

## Before searching
- Call list first to see available sources and their sourceIds.
- Always pass sourceId to search when you know which site to look in — scoped search is much more accurate than searching all sources at once.

## Indexing
- Scope the URL to the section you need: add https://docs.stripe.com/api instead of https://docs.stripe.com — faster and more focused.
- Sites with a sitemap.xml index most completely. Check at <domain>/sitemap.xml.
- Re-run add on an existing source to refresh its content. Source ID stays stable.
- JavaScript-rendered sites are handled automatically.

## Searching
- Use the site's own terminology, not generic terms. Examples from real sites:
  - Stripe calls charges "PaymentIntents" not "charges"
  - Cronofy calls OAuth "Individual Connect" not "OAuth flow"
  - Supabase calls serverless functions "Edge Functions" not "serverless functions"
  - Twilio uses "TwiML" for call flows, not "automated calls"
- If results look wrong, try rephrasing with the site's own language.
- If rephrasing doesn't help, call clear_cache for that source then search again — forces fresh LLM tree navigation.

## Performance
- First search on a source: ~5-15 seconds (LLM reads the full page tree).
- Repeat or similar searches: ~2-3 seconds (cached, no LLM call).
- The cache is cleared automatically when a source is re-indexed.

## Debugging bad results
1. Call tree on the source to see the page structure the LLM navigates.
2. Look for the section that should contain the answer — check if it exists.
3. If it exists but wasn't returned, clear_cache and retry with terminology closer to the section name.
4. If the site is large (300+ pages), consider indexing a more specific sub-path.`

      return { content: [{ type: 'text', text }] }
    }
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
