// Talks to Ollama REST API via native fetch
import { getConfig } from '../config/ConfigManager.js'

const OLLAMA_BASE_URL = "http://localhost:11434"
const EMBEDDING_MODEL = "nomic-embed-text"

export async function checkHealth(): Promise<void> {
  const { chatModel } = getConfig()
  let data: { models: { name: string }[] }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
    data = await response.json() as typeof data
  } catch {
    throw new Error("Ollama is not running. Start it with: ollama serve")
  }

  const models = data.models.map(m => m.name.split(":")[0])

  if (!models.includes(EMBEDDING_MODEL)) {
    throw new Error(`Embedding model not found. Run: ollama pull ${EMBEDDING_MODEL}`)
  }

  if (!models.includes(chatModel.split(':')[0]) && !models.includes(chatModel)) {
    throw new Error(`Chat model not found. Run: ollama pull ${chatModel}`)
  }

  console.log("✓ Ollama is running")
  console.log(`✓ ${EMBEDDING_MODEL} available`)
  console.log(`✓ ${chatModel} available`)
}

export async function chat(system: string, user: string): Promise<string> {
  const { chatModel } = getConfig()
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(120_000),  // 2 min timeout
    body: JSON.stringify({
      model: chatModel,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  const data = await response.json() as { message: { content: string } }
  return data.message.content
}

export async function embed(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
  })
  const data = await response.json() as { embedding: number[] }
  return data.embedding
}
