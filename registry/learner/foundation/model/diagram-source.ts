export interface DiagramSourceNode {
  id: string
  label: string
  x: number
  y: number
}

export interface DiagramSourceEdge {
  source: string
  target: string
}

export interface DiagramSource {
  nodes: DiagramSourceNode[]
  edges: DiagramSourceEdge[]
}

const NODE_PATTERN =
  /^node\s+([a-zA-Z0-9_-]+)\s+("(?:\\.|[^"\\])*")\s+at\s+(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/
const EDGE_PATTERN = /^([a-zA-Z0-9_-]+)\s*->\s*([a-zA-Z0-9_-]+)$/

function quotedLabel(value: string): string {
  return JSON.stringify(value.replace(/\s+/g, " ").trim() || "Untitled")
}

export function parseDiagramSource(source: string): DiagramSource {
  const nodes: DiagramSourceNode[] = []
  const edges: DiagramSourceEdge[] = []
  const ids = new Set<string>()

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const nodeMatch = NODE_PATTERN.exec(line)
    if (nodeMatch) {
      const [, id = "", encodedLabel = '""', x = "0", y = "0"] = nodeMatch
      if (ids.has(id)) continue
      let label = "Untitled"
      try {
        label = String(JSON.parse(encodedLabel))
      } catch {
        continue
      }
      ids.add(id)
      nodes.push({ id, label, x: Number(x), y: Number(y) })
      continue
    }
    const edgeMatch = EDGE_PATTERN.exec(line)
    if (edgeMatch) edges.push({ source: edgeMatch[1] ?? "", target: edgeMatch[2] ?? "" })
  }

  return {
    nodes,
    edges: edges.filter(({ source, target }) => ids.has(source) && ids.has(target)),
  }
}

export function serializeDiagramSource(diagram: DiagramSource): string {
  const nodes = diagram.nodes.map(
    ({ id, label, x, y }) =>
      `node ${id} ${quotedLabel(label)} at ${Math.round(x)},${Math.round(y)}`,
  )
  const nodeIds = new Set(diagram.nodes.map(({ id }) => id))
  const edges = diagram.edges
    .filter(({ source, target }) => nodeIds.has(source) && nodeIds.has(target))
    .map(({ source, target }) => `${source} -> ${target}`)
  return [...nodes, ...edges].join("\n")
}

export function defaultDiagramSource(): string {
  return serializeDiagramSource({
    nodes: [
      { id: "start", label: "Start", x: 0, y: 40 },
      { id: "next", label: "Next step", x: 280, y: 40 },
    ],
    edges: [{ source: "start", target: "next" }],
  })
}
