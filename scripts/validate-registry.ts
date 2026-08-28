import { readdir, readFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const itemNames = [
  "learner-foundation",
  "learner-runtime",
  "course-card",
  "course-catalog",
  "learner-home",
  "curriculum-journey",
  "enrolled-course-home",
  "course-player",
  "course-shell",
  "course-outline",
  "study-tools",
  "intake-form",
  "blocks",
] as const

type Registry = {
  $schema: string
  items: Array<{ name: string; registryDependencies?: string[] }>
}

type RegistryItem = {
  $schema: string
  dependencies: string[]
  files: Array<{ content: string; target: string }>
  name: string
  registryDependencies: string[]
}

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const publicRoot = resolve(root, "public/r")
const sourceRoot = resolve(root, "registry/learner")
const publicDependencyBase = "https://cursare.github.io/ui/r/v0/"

async function filesRecursively(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await filesRecursively(path)))
    else files.push(path)
  }
  return files.sort()
}

const expectedNames = [...itemNames].sort()
const registryRaw = await readFile(resolve(publicRoot, "registry.json"), "utf8")
const registry = JSON.parse(registryRaw) as Registry
if (registry.$schema !== "https://ui.shadcn.com/schema/registry.json") {
  throw new Error("Registry does not use the shadcn registry schema.")
}
const actualNames = registry.items.map((item) => item.name).sort()
if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
  throw new Error(`Unexpected public catalog: ${actualNames.join(", ")}`)
}
if ((await readFile(resolve(root, "registry.json"), "utf8")) !== registryRaw) {
  throw new Error("Root registry.json differs from the hosted catalog.")
}

const stableFiles = (await readdir(publicRoot)).filter((name) => name.endsWith(".json")).sort()
const expectedFiles = ["registry.json", ...itemNames.map((name) => `${name}.json`)].sort()
if (JSON.stringify(stableFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(`Unexpected hosted artifacts: ${stableFiles.join(", ")}`)
}

const sources = new Map<string, string>()
for (const name of itemNames) {
  const stableRaw = await readFile(resolve(publicRoot, `${name}.json`), "utf8")
  const versionedRaw = await readFile(resolve(publicRoot, "v0", `${name}.json`), "utf8")
  if (stableRaw !== versionedRaw) throw new Error(`${name} differs from its v0 artifact.`)

  const item = JSON.parse(stableRaw) as RegistryItem
  if (item.name !== name || !item.$schema.includes("shadcn.com/schema/registry-item.json")) {
    throw new Error(`Invalid registry item ${name}.`)
  }
  for (const dependency of item.registryDependencies) {
    if (!dependency.startsWith(publicDependencyBase)) {
      throw new Error(`${name} has a non-public registry dependency: ${dependency}`)
    }
  }
  for (const file of item.files) {
    const prefix = "@components/cursare/"
    if (!file.target.startsWith(prefix)) throw new Error(`${name} escapes the learner namespace.`)
    if (/from\s+["'](?:@cursare\/|next\/|@\/app\/)/.test(file.content)) {
      throw new Error(`${file.target} contains a host-only import.`)
    }
    const path = file.target.slice(prefix.length)
    const existing = sources.get(path)
    if (existing !== undefined && existing !== file.content) {
      throw new Error(`Registry items disagree on ${path}.`)
    }
    sources.set(path, file.content)
  }
}

const materializedFiles = await filesRecursively(sourceRoot)
const materializedPaths = materializedFiles.map((path) => relative(sourceRoot, path)).sort()
const expectedPaths = [...sources.keys()].sort()
if (JSON.stringify(materializedPaths) !== JSON.stringify(expectedPaths)) {
  throw new Error("Browsable learner source does not match the registry artifacts.")
}
for (const [path, content] of sources) {
  if ((await readFile(resolve(sourceRoot, path), "utf8")) !== content) {
    throw new Error(`Browsable source differs from registry content: ${path}`)
  }
}

const blocks = JSON.parse(
  await readFile(resolve(publicRoot, "blocks.json"), "utf8"),
) as RegistryItem
if (!blocks.dependencies.some((dependency) => dependency.startsWith("@base-ui/react@"))) {
  throw new Error("The aggregate no longer carries its COSS/Base UI runtime dependency.")
}
if (!blocks.files.some((file) => file.target.endsWith("/course-player.tsx"))) {
  throw new Error("The complete learner aggregate is missing course-player.")
}

console.log(`Validated ${itemNames.length} learner items and ${sources.size} source files.`)
