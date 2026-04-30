import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { searchSource, searchAll } from '../search/Searcher.js'
import { run as indexerRun } from '../indexer/Indexer.js'
import { listSources, getSource, removeSource } from '../store/SourceRegistry.js'
import { deleteSource } from '../store/VectorStore.js'
import { loadTree } from '../tree/TreeSerializer.js'
import { checkHealth } from '../ollama/OllamaClient.js'
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

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
