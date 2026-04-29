import fs from 'fs'
import path from 'path'
import os from 'os'

const LOCALDOCS_DIR = path.join(os.homedir(), '.localdocs')
const CONFIG_PATH = path.join(LOCALDOCS_DIR, 'config.json')

const DEFAULT_CONFIG = {
  chatModel: 'llama3.2',
}

export type Config = typeof DEFAULT_CONFIG

// ensure ~/.localdocs/ exists and set CRAWLEE_STORAGE_DIR
export function initDirs(): void {
  fs.mkdirSync(LOCALDOCS_DIR, { recursive: true })
  process.env.CRAWLEE_STORAGE_DIR = path.join(LOCALDOCS_DIR, 'crawlee-storage')
}

export function getConfig(): Config {
  initDirs()
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function setConfig(key: keyof Config, value: string): void {
  initDirs()
  const current = getConfig()
  const updated = { ...current, [key]: value }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2))
}
