# localdocs

Index any documentation site and search it with natural language - entirely on your machine. No cloud, no API keys, no cost.

Works as a CLI and as an MCP server for Claude Code, Cursor, or any MCP-compatible editor.

---

## The idea

Most developers either pay for cloud RAG tools or settle for ctrl+F. localdocs is a third option: a fully local documentation search tool that runs entirely on your hardware using [Ollama](https://ollama.com).

Every part of the pipeline - embedding, reasoning, reranking - runs on your machine via local LLMs. Your docs never leave your computer, and it costs nothing to run - no subscriptions, no per-query fees, no API keys.

---

## Why this is different from regular search

Standard keyword search finds pages that contain your exact words. Vector search finds pages semantically similar to your query. localdocs does both, and adds a reasoning layer on top - all powered by your local models.

**How a search works:**

1. **Tree reasoning** - a local LLM looks at the section tree of the indexed docs (URL hierarchy + headings) and identifies which sections are most likely to contain your answer. Instead of searching the entire corpus, search is scoped to relevant sections only.

2. **Hybrid search** - inside those sections, vector search (semantic meaning) and BM25 (keyword relevance) run in parallel. Results are merged using Reciprocal Rank Fusion - chunks appearing in both result lists rank higher.

3. **Reranking** - a local LLM reads the top results and filters out anything that doesn't genuinely answer the query.

The result: you can search vague natural language like "how do I handle side effects" and get the right page, and you can search exact terms like `useEffect dependency array` and get precise keyword matches. No cloud required.

---

## Requirements

- Node.js 18+
- [Ollama](https://ollama.com) installed and running (`ollama serve`)
- Pull the required models:
  ```bash
  ollama pull nomic-embed-text   # embedding model - converts text to vectors
  ollama pull llama3.2           # chat model - tree reasoning + reranking
  ```

---

## Install

```bash
npm install -g local-docs
```

---

## Quick start

```bash
# verify everything is set up
localdocs check

# index a docs site
localdocs add https://react.dev/learn

# search it
localdocs search "how do I manage state between components"
```

---

## CLI Reference

### `localdocs add <url>`

Crawls and indexes a documentation site. Scoped to the path you provide - `localdocs add https://docs.example.com/api` only indexes `/api/*`, not the entire site.

Re-running on an already-indexed URL refreshes the content. Source ID stays stable so nothing breaks.

---

### `localdocs search "<query>"`

Search all indexed sources with natural language.

```bash
localdocs search "how do I manage state"
localdocs search "useEffect dependency array"
localdocs search "how do I verify webhook signatures"
```

Search a specific source with `-s`:
```bash
localdocs search "how do I manage state" -s react-dev-learn
```

Scoped search is more reliable when you have multiple unrelated sources indexed.

---

### `localdocs list`

Show all indexed sources - source ID, URL, chunk count, and when indexed.

```bash
localdocs list

# 2 source(s) indexed:
#
#   react-dev-learn
#     url:     https://react.dev/learn
#     chunks:  563
#     indexed: 30/04/2026, 2:48:48 am
```

The source ID is what you pass to `-s` for scoped search.

---

### `localdocs tree <sourceId>`

Print the section tree for a source - the structure the LLM uses to narrow searches.

```bash
localdocs tree react-dev-learn
```

---

### `localdocs remove <sourceId>`

Remove a source and all its data - vectors, tree, registry entry.

---

### `localdocs check`

Verify Ollama is running and required models are pulled. Run this first if anything seems broken.

---

### `localdocs config`

```bash
localdocs config show
localdocs config set chatModel gemma3:27b
```

The chat model handles tree reasoning and reranking. Default is `llama3.2`. Any model pulled in Ollama works - larger models improve search quality, smaller models are faster.

The embedding model is fixed as `nomic-embed-text`. It is specifically optimised for retrieval and changing it would invalidate all stored vectors.

---

## MCP Server

localdocs runs as an MCP server so any MCP-compatible client (Claude Code, Cursor, Windsurf, Codex, or any other) can search your indexed docs as a tool while you code.

Add this to your MCP client's config:
```json
{
  "localdocs": {
    "command": "localdocs",
    "args": ["serve"]
  }
}
```

The server launches automatically when your client starts and stays running for the session.

Available tools: `search`, `add`, `list`, `tree`, `remove`, `check`

---

## Tips

- Sites with a `sitemap.xml` index most reliably - check by visiting `<domain>/sitemap.xml`
- Use `-s <sourceId>` when searching a specific source for more precise results
- Larger Ollama models give better reasoning quality: `localdocs config set chatModel llama3.3:70b`
- Re-index any source with `localdocs add <url>` to pick up new content

---

## Data storage

```
~/.localdocs/
├── sources.json          # registry of indexed sources
├── config.json           # config (chatModel etc.)
├── db/                   # LanceDB vector + BM25 indexes
└── sources/<id>/
    └── tree.json         # section tree per source
```
