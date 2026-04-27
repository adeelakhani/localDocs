import fs from 'fs'
import path from 'path'
import os from 'os'

export interface Source {
  id: string
  name: string
  url: string
  indexedAt: string
  chunkCount: number
  embeddingModel: string
  embeddingDim: number
}

const BASE_DIR = path.join(os.homedir(), '.localdocs')
const REGISTRY_PATH = path.join(BASE_DIR, 'sources.json')

function ensureDir(): void {
  fs.mkdirSync(BASE_DIR, { recursive: true })
}

function readAll(): Source[] {
  if (!fs.existsSync(REGISTRY_PATH)) return []
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as Source[]
}

function writeAll(sources: Source[]): void {
  ensureDir()
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(sources, null, 2))
}

export function listSources(): Source[] {
  return readAll()
}

export function getSource(id: string): Source | null {
  return readAll().find(s => s.id === id) ?? null
}

export function registerSource(source: Source): void {
  const sources = readAll().filter(s => s.id !== source.id)
  sources.push(source)
  writeAll(sources)
}

export function removeSource(id: string): void {
  writeAll(readAll().filter(s => s.id !== id))
}
