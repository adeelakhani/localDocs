import * as lancedb from '@lancedb/lancedb'
import { makeArrowTable } from '@lancedb/lancedb'
import { Schema, Field, Utf8, Int32, FixedSizeList, Float32 } from 'apache-arrow'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { Chunk } from '../chunker/Chunker.js'

const DB_PATH = path.join(os.homedir(), '.localdocs', 'db')
const EMBEDDING_DIM = 768

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

  const rows = chunks.map((chunk, i) => ({
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

  const table = makeArrowTable(rows, { schema: getSchema() })

  const tableNames = await db.tableNames()
  if (tableNames.includes(sourceId)) {
    await db.dropTable(sourceId)
  }

  await db.createTable(sourceId, table)
}
