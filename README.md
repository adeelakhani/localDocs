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
  ollama pull phi4-mini          # chat model - tree reasoning + reranking
  ```

---

## Install

```bash
npm install -g @adeel712/localdocs
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

### `localdocs cache`

Manage the reasoning cache. localdocs caches which tree nodes the LLM picks for each query — repeat and similar searches skip the LLM entirely and return instantly.

```bash
localdocs cache stats                      # show entry count per source
localdocs cache stats docs-cronofy-com     # show for one source
localdocs cache clear                      # clear all caches
localdocs cache clear docs-cronofy-com     # clear one source's cache
```

The cache is cleared automatically when you re-index a source. Clear it manually if search results feel stale.

---

### `localdocs check`

Verify Ollama is running and required models are pulled. Run this first if anything seems broken.

---

### `localdocs config`

```bash
localdocs config show
localdocs config set chatModel gemma4:26b
```

The chat model handles tree reasoning and reranking. Default is `phi4-mini`. Any model pulled in Ollama works - larger models improve search quality, smaller models are faster.

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

Available tools: `search`, `add`, `list`, `tree`, `remove`, `check`, `clear_cache`, `how_to_use`

The `how_to_use` tool returns best practices for agents — when to scope URLs, how to handle terminology mismatches, how the cache works, and how to debug bad results. Call it once when getting started.

---

## macOS app (experimental)

A native SwiftUI window for searching your indexed docs, in `mac/`. Wraps the CLI — same engine, native UI.

Requirements: macOS 13+, Swift toolchain (ships with Xcode or Command Line Tools), `localdocs` on your `PATH`, Ollama running.

```bash
cd mac
swift run
```

A search window opens — type a query, hit return, click a result to open the source URL in your browser. Cmd+Q to quit.

---

## Model selection

localdocs uses two models — one for embeddings (fixed) and one for reasoning (configurable).

**Embedding model:** `nomic-embed-text` — fixed, do not change. It's specifically optimised for retrieval and all stored vectors depend on it.

**Chat model:** handles tree navigation and reranking. Default is `phi4-mini`.

Tested 10+ models for this task. Key findings:

| Model | Size | Quality | Speed | Notes |
|---|---|---|---|---|
| `phi4-mini` | 2.5GB | Good | Fast | Default. Best balance for most use cases. |
| `llama3.2` | 2GB | Acceptable | Fastest | Good fallback if phi4-mini isn't available |
| `qwen2.5:14b` | 9GB | Good | Slow | Marginally better on large sites |
| `gemma4:26b` | 17GB | Excellent | Very slow | Best quality but ~5 min per cold search |
| `mistral:7b` | 4.4GB | Poor | Medium | Not recommended — hallucinates node IDs |
| `deepseek-coder:6.7b` | 3.8GB | Poor | Medium | Not recommended — worst accuracy tested |

Switch models any time:
```bash
localdocs config set chatModel gemma4:26b
```

**Important:** the first search on a site is slow (the LLM reads the full page tree). Subsequent searches on the same site are fast thanks to the semantic cache — the LLM result is reused for similar queries.

---

## Tips

**Indexing**
- Sites with a `sitemap.xml` index most reliably and completely. Check at `<domain>/sitemap.xml` before indexing.
- Scope your index to the relevant path: `localdocs add https://docs.example.com/api` only indexes `/api/*`.
- JavaScript-rendered sites are handled automatically via a Playwright fallback — no extra setup needed.
- Re-index any time with `localdocs add <url>` to pick up new content. The source ID stays stable.

**Searching**
- Always use `-s <sourceId>` when you have multiple sources — scoped search is significantly more reliable.
- If results feel wrong, try rephrasing. "OAuth flow" and "how do I authorize a user" may route to different tree nodes.
- Run `localdocs cache clear <sourceId>` after rephrasing to force fresh LLM reasoning on the next search.
- `localdocs cache stats` shows how many queries are cached per source.

**Performance**
- First search on a site: ~5-15s (LLM reads tree, caches result).
- Repeat or similar searches: ~2-3s (cache hit, no LLM call).
- The cache is per-source and cleared automatically on re-index.
- Larger models improve cold-search quality but the cache means you only pay the cost once per unique query.

---

## Known limitations

**Tree navigation on large sites**

localdocs scopes search by asking a local LLM to read a list of all page names and pick the relevant ones. For small sites (under ~150 pages) this works reliably. For large sites (300+ pages), small models (under ~20B parameters) can pick the wrong section, especially when the site uses product-specific naming that doesn't match common terminology.

Examples of tricky cases tested:
- "OAuth flow" → page is called "Individual Connect" (Cronofy's name for OAuth)
- "serverless functions" → page is called "Edge Functions" (Supabase's name)
- "charge a customer" → page is called "PaymentIntent" (Stripe's abstraction)

**Workarounds:**
- Use a larger model: `localdocs config set chatModel gemma4:26b` — 26B+ models handle this well
- Rephrase to match the site's own terminology
- The semantic cache means once a query routes correctly, similar queries reuse the result

**JS-rendered sites**

Sites that render content via JavaScript are crawled with a Playwright fallback. This works for most sites but may miss pages on heavily dynamic sites.

---

## Data storage

```
~/.localdocs/
├── sources.json          # registry of indexed sources
├── config.json           # config (chatModel etc.)
├── db/                   # LanceDB vector + BM25 indexes
└── sources/<id>/
    ├── tree.json         # section tree per source
    └── reasoning-cache.json  # cached LLM tree reasoning results
```
