// Lesson-sized snippets only, so the O(n·m) LCS table is fine.

export interface DiffLine {
  kind: "same" | "added" | "removed"
  text: string
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n")
  const b = after.split("\n")
  const n = a.length
  const m = b.length

  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const row = table[i]
      if (!row) continue
      row[j] =
        a[i] === b[j]
          ? (table[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(table[i + 1]?.[j] ?? 0, table[i]?.[j + 1] ?? 0)
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] ?? "" })
      i++
      j++
    } else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      out.push({ kind: "removed", text: a[i] ?? "" })
      i++
    } else {
      out.push({ kind: "added", text: b[j] ?? "" })
      j++
    }
  }
  while (i < n) out.push({ kind: "removed", text: a[i++] ?? "" })
  while (j < m) out.push({ kind: "added", text: b[j++] ?? "" })
  return out
}
