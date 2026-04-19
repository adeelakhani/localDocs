// Talks to Ollama REST API via native fetch

const OLLAMA_BASE_URL = "http://localhost:11434"
const EMBEDDING_MODEL = "nomic-embed-text"
const CHAT_MODEL = "llama3.2"

export async function checkHealth(): Promise<void> {
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

  if (!models.includes(CHAT_MODEL)) {
    throw new Error(`Chat model not found. Run: ollama pull ${CHAT_MODEL}`)
  }

  console.log("✓ Ollama is running")
  console.log(`✓ ${EMBEDDING_MODEL} available`)
  console.log(`✓ ${CHAT_MODEL} available`)
}

await checkHealth()
