import pLimit from 'p-limit'
import { checkHealth, embed } from '../ollama/OllamaClient.js'
import { crawl } from '../crawl/Crawler.js'
import { extractPage } from '../crawl/Extractor.js'
import { buildTree } from '../tree/TreeBuilder.js'
import { saveTree, flattenTree } from '../tree/TreeSerializer.js'
import { chunkPage } from '../chunker/Chunker.js'
import { insertChunks } from '../store/VectorStore.js'
import { registerSource } from '../store/SourceRegistry.js'
import { urlToSourceId } from '../utils/sourceId.js'

const EMBED_CONCURRENCY = 5

export async function run(url: string): Promise<void> {
  const sourceId = urlToSourceId(url)
  const rootOrigin = new URL(url).origin

  // 1. pre-flight check
  await checkHealth()

  // 2. crawl
  console.log(`\nCrawling ${url}...`)
  const crawledUrls = await crawl(url)
  console.log(`✓ Found ${crawledUrls.length} URLs`)

  // 3. extract each page
  console.log(`\nExtracting pages...`)
  const pages = []
  for (const crawledUrl of crawledUrls) {
    const pageUrl = crawledUrl.url
    const depth = crawledUrl.depth
    const response = await fetch(pageUrl)
    if (new URL(response.url).origin !== rootOrigin) continue
    const html = await response.text()
    const result = extractPage(html, pageUrl)
    if (result) {
      pages.push({ url: pageUrl, depth, ...result })
      process.stdout.write(`\r  ${pages.length}/${crawledUrls.length} pages extracted`)
    }
  }
  console.log(`\n✓ Extracted ${pages.length} pages`)

  // 4. build tree
  console.log(`\nBuilding tree...`)
  const tree = buildTree(pages, sourceId)
  saveTree(sourceId, tree)
  const nodeMap = flattenTree(tree)
  console.log(`✓ Tree saved`)

  // 5. chunk
  console.log(`\nChunking pages...`)
  const allChunks = []
  for (const page of pages) {
    allChunks.push(...chunkPage(page, sourceId, nodeMap))
  }
  console.log(`✓ ${allChunks.length} chunks`)

  // 6. embed with concurrency limit
  console.log(`\nEmbedding chunks...`)
  const limit = pLimit(EMBED_CONCURRENCY)
  let done = 0
  const embeddings = await Promise.all(
    allChunks.map(chunk =>
      limit(async () => {
        try {
          const vector = await embed(chunk.text)
          process.stdout.write(`\r  ${++done}/${allChunks.length}`)
          return vector
        } catch {
          process.stdout.write(`\r  ${++done}/${allChunks.length} (embed failed)`)
          return null
        }
      })
    )
  )

  const validChunks = allChunks.filter((_, i) => embeddings[i] !== null)
  const validEmbeddings = embeddings.filter((e): e is number[] => e !== null)
  console.log(`\n✓ Embeddings done`)

  // 7. store in LanceDB
  console.log(`\nStoring in LanceDB...`)
  await insertChunks(sourceId, validChunks, validEmbeddings)
  console.log(`✓ Stored`)

  // 8. register source
  await registerSource({
    id: sourceId,
    name: new URL(url).hostname,
    url,
    indexedAt: new Date().toISOString(),
    chunkCount: validChunks.length,
    embeddingModel: 'nomic-embed-text',
    embeddingDim: 768,
  })

  console.log(`\n✓ Done — indexed ${validChunks.length} chunks from ${pages.length} pages`)
  console.log(`  Source ID: ${sourceId}`)
}
