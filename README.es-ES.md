

# localdocs

Índice cualquier sitio de documentación y búscala con lenguaje natural: completamente en tu máquina. Sin nube, sin claves de API, sin costo.

Funciona como una CLI y como un servidor MCP para Claude Code, Cursor o cualquier editor compatible con MCP.

---

## La idea

La mayoría de los desarrolladores o bien pagan por herramientas RAG en la nube o se conforman con Ctrl+F. localdocs es una tercera opción: una herramienta de búsqueda de documentación completamente local que se ejecuta enteramente en tu hardware usando [Ollama](https://ollama.com).

Cada parte del flujo de trabajo: incrustación (embedding), razonamiento y reordenamiento (reranking) - se ejecuta en tu máquina mediante LLM locales. Tus documentos nunca salen de tu computadora y su uso no tiene costo: sin suscripciones, sin tarifas por consulta, sin claves de API.

---

## Por qué es diferente de la búsqueda regular

La búsqueda por palabras clave estándar encuentra páginas que contienen tus palabras exactas. La búsqueda vectorial encuentra páginas semanticamente similares a tu consulta. localdocs hace ambas cosas y añade una capa de razonamiento encima, todo impulsado por tus modelos locales.

**Cómo funciona una búsqueda:**

1. **Razonamiento de árbol** - un LLM local analiza el árbol de secciones de los documentos indexados (jerarquía de URLs + encabezados) e identifica qué secciones es más probable que contengan tu respuesta. En lugar de buscar en todo el corpus, la búsqueda se limita únicamente a las secciones relevantes.

2. **Búsqueda híbrida** - dentro de esas secciones, la búsqueda vectorial (significado semántico) y BM25 (relevancia de palabras clave) se ejecutan en paralelo. Los resultados se fusionan usando Reciprocal Rank Fusion; los fragmentos que aparecen en ambas listas obtienen mayor relevancia.

3. **Reordenamiento (reranking)** - un LLM local lee los principales resultados y filtra todo lo que no responda genuinamente a la consulta.

El resultado: puedes buscar con lenguaje natural vago como "cómo manejo los efectos secundarios" y obtener la página correcta, o buscar términos exactos como `useEffect dependency array` y obtener coincidencias precisas de palabras clave. Sin necesidad de la nube.

---

## Requisitos

- Node.js 18+
- [Ollama](https://ollama.com) instalado y en ejecución (`ollama serve`)
- Descarga los modelos requeridos:
  ```bash
  ollama pull nomic-embed-text   # modelo de embeddings: convierte texto a vectores
  ollama pull phi4-mini          # modelo de chat: razonamiento de árbol + reranking
  ```

---

## Instalación

```bash
npm install -g @adeel712/localdocs
```

---

## Inicio rápido

```bash
# verifica que todo esté configurado
localdocs check

# indexa un sitio de documentación
localdocs add https://react.dev/learn

# búscala
localdocs search "how do I manage state between components"
```

---

## Referencia de la CLI

### `localdocs add <url>`

Recorre e indexa un sitio de documentación. Se limita a la ruta que proporciones: `localdocs add https://docs.example.com/api` solo indexa `/api/*`, no todo el sitio.

Ejecutarlo nuevamente sobre una URL ya indexada actualiza el contenido. El ID de la fuente permanece estable para que nada se rompa.

---

### `localdocs search "<query>"`

Busca en todas las fuentes indexadas con lenguaje natural.

```bash
localdocs search "how do I manage state"
localdocs search "useEffect dependency array"
localdocs search "how do I verify webhook signatures"
```

Busca en una fuente específica con `-s`:
```bash
localdocs search "how do I manage state" -s react-dev-learn
```

La búsqueda con alcance específico es más confiable cuando tienes múltiples fuentes no relacionadas indexadas.

---

### `localdocs list`

Muestra todas las fuentes indexadas: ID de fuente, URL, cantidad de fragmentos y fecha de indexación.

```bash
localdocs list

# 2 fuente(s) indexada(s):
#
#   react-dev-learn
#     url:     https://react.dev/learn
#     fragmentos:  563
#     indexada: 30/04/2026, 2:48:48 a.m.
```

El ID de la fuente es lo que pasas a `-s` para la búsqueda con alcance específico.

---

### `localdocs tree <sourceId>`

Imprime el árbol de secciones de una fuente: la estructura que el LLM utiliza para acotar las búsquedas.

```bash
localdocs tree react-dev-learn
```

---

### `localdocs remove <sourceId>`

Elimina una fuente y todos sus datos: vectores, árbol y entrada en el registro.

---

### `localdocs cache`

Gestiona la caché de razonamiento. localdocs almacena en caché qué nodos del árbol selecciona el LLM para cada consulta: las búsquedas repetidas y similares omiten por completo al LLM y devuelven resultados al instante.

```bash
localdocs cache stats                      # muestra el número de entradas por fuente
localdocs cache stats docs-cronofy-com     # muestra para una fuente
localdocs cache clear                      # limpia todas las cachés
localdocs cache clear docs-cronofy-com     # limpia la caché de una fuente
```

La caché se limpia automáticamente cuando vuelves a indexar una fuente. Límpiela manualmente si los resultados de la búsqueda parecen desactualizados.

---

### `localdocs check`

Verifica que Ollama esté en ejecución y que los modelos requeridos estén descargados. Ejecuta esto primero si algo parece no funcionar.

---

### `localdocs config`

```bash
localdocs config show
localdocs config set chatModel gemma4:26b
```

El modelo de chat se encarga del razonamiento del árbol y del reordenamiento. El predeterminado es `phi4-mini`. Funciona con cualquier modelo descargado en Ollama: los modelos más grandes mejoran la calidad de la búsqueda, los más pequeños son más rápidos.

El modelo de embeddings está fijo como `nomic-embed-text`. Está específicamente optimizado para recuperación y cambiarlo invalidaría todos los vectores almacenados.

---

## Servidor MCP

localdocs funciona como un servidor MCP para que cualquier cliente compatible con MCP (Claude Code, Cursor, Windsurf, Codex o cualquier otro) pueda buscar en tus documentos indexados como una herramienta mientras programas.

Agrega esto a la configuración de tu cliente MCP:
```json
{
  "localdocs": {
    "command": "localdocs",
    "args": ["serve"]
  }
}
```

El servidor se inicia automáticamente cuando tu cliente arranca y permanece en ejecución durante la sesión.

Herramientas disponibles: `search`, `add`, `list`, `tree`, `remove`, `check`, `clear_cache`, `how_to_use`

La herramienta `how_to_use` devuelve las mejores prácticas para agentes: cuándo acotar URLs, cómo manejar incompatibilidades de terminología, cómo funciona la caché y cómo depurar malos resultados. Llámala una vez al comenzar.

---

## Aplicación para macOS (experimental)

Una ventana nativa de SwiftUI para buscar en tus documentos indexados, en `mac/`. Envuelve la CLI: mismo motor, interfaz nativa.

Requisitos: macOS 13+, cadena de herramientas Swift (incluida con Xcode o Command Line Tools), `localdocs` en tu `PATH`, Ollama en ejecución.

```bash
cd mac
swift run
```

Se abre una ventana de búsqueda: escribe una consulta, presiona Return, haz clic en un resultado para abrir la URL de origen en tu navegador. Cmd+Q para salir.

---

## Selección de modelos

localdocs utiliza dos modelos: uno para embeddings (fijo) y otro para razonamiento (configurable).

**Modelo de embeddings:** `nomic-embed-text` — fijo, no lo cambies. Está específicamente optimizado para recuperación y todos los vectores almacenados dependen de él.

**Modelo de chat:** se encarga de la navegación del árbol y el reordenamiento. El predeterminado es `phi4-mini`.

Se probaron más de 10 modelos para esta tarea. Hallazgos clave:

| Modelo | Tamaño | Calidad | Velocidad | Notas |
|---|---|---|---|---|
| `phi4-mini` | 2.5GB | Buena | Rápido | Predeterminado. El mejor equilibrio para la mayoría de los casos de uso. |
| `llama3.2` | 2GB | Aceptable | El más rápido | Buena alternativa si phi4-mini no está disponible |
| `qwen2.5:14b` | 9GB | Buena | Lento | Marginalmente mejor en sitios grandes |
| `gemma4:26b` | 17GB | Excelente | Muy lento | La mejor calidad, pero ~5 min por búsqueda en frío |
| `mistral:7b` | 4.4GB | Pobre | Media | No recomendado: alucina IDs de nodos |
| `deepseek-coder:6.7b` | 3.8GB | Pobre | Media | No recomendado: la peor precisión probada |

Cambia de modelo en cualquier momento:
```bash
localdocs config set chatModel gemma4:26b
```

**Importante:** la primera búsqueda en un sitio es lenta (el LLM lee el árbol completo de páginas). Las búsquedas posteriores en el mismo sitio son rápidas gracias a la caché semántica: el resultado del LLM se reutiliza para consultas similares.

---

## Consejos

**Indexación**
- Los sitios con un `sitemap.xml` se indexan de manera más confiable y completa. Revisa `<domain>/sitemap.xml` antes de indexar.
- Acota tu índice a la ruta relevante: `localdocs add https://docs.example.com/api` solo indexa `/api/*`.
- Los sitios renderizados con JavaScript se manejan automáticamente mediante una alternativa de Playwright: no se necesita configuración adicional.
- Vuelve a indexar en cualquier momento con `localdocs add <url>` para incorporar nuevo contenido. El ID de la fuente permanece estable.

**Búsqueda**
- Usa siempre `-s <sourceId>` cuando tengas múltiples fuentes: la búsqueda con alcance específico es significativamente más confiable.
- Si los resultados parecen incorrectos, intenta reformular. "Flujo OAuth" y "cómo autorizo a un usuario" pueden enrutar a diferentes nodos del árbol.
- Ejecuta `localdocs cache clear <sourceId>` después de reformular para forzar un razonamiento fresco del LLM en la siguiente búsqueda.
- `localdocs cache stats` muestra cuántas consultas están en caché por fuente.

**Rendimiento**
- Primera búsqueda en un sitio: ~5-15s (el LLM lee el árbol y almacena el resultado en caché).
- Búsquedas repetidas o similares: ~2-3s (acierto en caché, sin llamada al LLM).
- La caché es por fuente y se limpia automáticamente al volver a indexar.
- Los modelos más grandes mejoran la calidad de las búsquedas en frío, pero la caché significa que solo pagas el costo una vez por cada consulta única.

---

## Limitaciones conocidas

**Navegación del árbol en sitios grandes**

localdocs acota la búsqueda pidiendo a un LLM local que lea una lista de todos los nombres de páginas y seleccione los relevantes. Para sitios pequeños (menos de ~150 páginas) funciona de manera confiable. Para sitios grandes (300+ páginas), los modelos pequeños (menos de ~20B de parámetros) pueden seleccionar la sección incorrecta, especialmente cuando el sitio usa nombres específicos del producto que no coinciden con la terminología común.

Ejemplos de casos complicados probados:
- "Flujo OAuth" → la página se llama "Individual Connect" (nombre que Cronofy usa para OAuth)
- "Funciones sin servidor" → la página se llama "Edge Functions" (nombre de Supabase)
- "Cobrar a un cliente" → la página se llama "PaymentIntent" (abstracción de Stripe)

**Soluciones alternativas:**
- Usa un modelo más grande: `localdocs config set chatModel gemma4:26b` — los modelos de 26B+ manejan esto bien
- Reformula para coincidir con la terminología propia del sitio
- La caché semántica significa que, una vez que una consulta enruta correctamente, las consultas similares reutilizan el resultado

**Sitios renderizados con JS**

Los sitios que renderizan contenido mediante JavaScript se recorren con una alternativa de Playwright. Esto funciona para la mayoría de los sitios, pero podría pasar por alto páginas en sitios altamente dinámicos.

---

## Almacenamiento de datos

```
~/.localdocs/
├── sources.json          # registro de fuentes indexadas
├── config.json           # configuración (chatModel, etc.)
├── db/                   # índices vectoriales + BM25 de LanceDB
└── sources/<id>/
    ├── tree.json         # árbol de secciones por fuente
    └── reasoning-cache.json  # resultados de razonamiento del árbol en caché
```
