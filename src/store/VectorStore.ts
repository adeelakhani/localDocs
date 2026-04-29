import * as lancedb from '@lancedb/lancedb'
import { makeArrowTable, MatchQuery } from '@lancedb/lancedb'
import { Schema, Field, Utf8, Int32, FixedSizeList, Float32 } from 'apache-arrow'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { Chunk } from '../chunker/Chunker.js'

const DB_PATH = path.join(os.homedir(), '.localdocs', 'db')
const EMBEDDING_DIM = 768
const RRF_K = 60  // standard RRF constant — higher = less aggressive rank fusion

function getSchema(): Schema {
  return new Schema([
    new Field('id', new Utf8()),
    new Field('sourceId', new Utf8()),
    new Field('treeNodeId', new Utf8()),
    new Field('treePath', new Utf8()),
    new Field('url', new Utf8()),
    new Field('pageTitle', new Utf8()),
    new Field('headingLevel', new Int32()),
    new Field('text', new Utf8()),
    new Field('embedding', new FixedSizeList(EMBEDDING_DIM, new Field('item', new Float32()))),
  ])
}

export async function insertChunks(
  sourceId: string,
  chunks: Chunk[],
  embeddings: number[][]
): Promise<void> {
  fs.mkdirSync(DB_PATH, { recursive: true })

  const db = await lancedb.connect(DB_PATH)

  const rows = chunks
    .map((chunk, i) => ({
      id: chunk.id,
      sourceId: chunk.sourceId,
      treeNodeId: chunk.treeNodeId,
      treePath: chunk.treePath,
      url: chunk.url,
      pageTitle: chunk.pageTitle,
      headingLevel: chunk.headingLevel,
      text: chunk.text,
      embedding: embeddings[i],
    }))
    .filter(row => Array.isArray(row.embedding) && row.embedding.length === EMBEDDING_DIM)

  const table = makeArrowTable(rows, { schema: getSchema() })

  const tableNames = await db.tableNames()
  if (tableNames.includes(sourceId)) {
    await db.dropTable(sourceId)
  }

  const createdTable = await db.createTable(sourceId, table)

  // create FTS index on text column for BM25 search
  await createdTable.createIndex('text', { config: lancedb.Index.fts() })
}

export interface SearchResult {
  id: string
  sourceId: string
  treeNodeId: string
  treePath: string
  url: string
  pageTitle: string
  text: string
  score: number
}

// merge two ranked lists using Reciprocal Rank Fusion
// score = 1/(k + rank) summed across both lists
// chunks appearing in both lists score higher than chunks in only one
function rrfMerge(
  vectorResults: SearchResult[],
  bm25Results: SearchResult[],
  topK: number
): SearchResult[] {
  const scores = new Map<string, number>()
  const chunkMap = new Map<string, SearchResult>()

  vectorResults.forEach((r, i) => {
    scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1))
    chunkMap.set(r.id, r)
  })

  bm25Results.forEach((r, i) => {
    scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1))
    chunkMap.set(r.id, r)
  })

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id, score]) => ({ ...chunkMap.get(id)!, score }))
}

export async function search(
  sourceId: string,
  queryVector: number[],
  query: string,
  nodeIds: string[] | null,  // null = search everything (full-corpus fallback)
  topK = 10
): Promise<SearchResult[]> {
  const db = await lancedb.connect(DB_PATH)
  const tableNames = await db.tableNames()
  if (!tableNames.includes(sourceId)) return []

  const table = await db.openTable(sourceId)

  const whereClause = nodeIds && nodeIds.length > 0
    ? `treeNodeId IN (${nodeIds.map(id => `'${id}'`).join(', ')})`
    : undefined

  // run vector search and BM25 in parallel
  const fetchK = topK * 2  // fetch more than needed before RRF merge

  const [vectorRows, bm25Rows] = await Promise.all([
    (whereClause
      ? table.vectorSearch(queryVector).where(whereClause).limit(fetchK)
      : table.vectorSearch(queryVector).limit(fetchK)
    ).toArray(),
    (whereClause
      ? table.search(new MatchQuery(query, 'text')).where(whereClause).limit(fetchK)
      : table.search(new MatchQuery(query, 'text')).limit(fetchK)
    ).toArray(),
  ])

  const toResults = (rows: Record<string, unknown>[]): SearchResult[] =>
    rows.map(row => ({
      id: String(row.id),
      sourceId: String(row.sourceId),
      treeNodeId: String(row.treeNodeId),
      treePath: String(row.treePath),
      url: String(row.url),
      pageTitle: String(row.pageTitle),
      text: String(row.text),
      score: Number(row._distance ?? row._score ?? 0),
    }))

  return rrfMerge(toResults(vectorRows), toResults(bm25Rows), topK)
}

export async function deleteSource(sourceId: string): Promise<void> {
  const db = await lancedb.connect(DB_PATH)
  const tableNames = await db.tableNames()
  if (tableNames.includes(sourceId)) {
    await db.dropTable(sourceId)
  }
}
