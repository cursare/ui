import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
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

type RegistryItem = {
  homepage?: string
  items?: Array<{ registryDependencies?: string[] }>
  files?: Array<{ content: string; target: string }>
  registryDependencies?: string[]
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const input = process.argv[2]
if (!input) throw new Error("Usage: bun run registry:sync <path-to-cursare-or-registry>")

const candidate = resolve(input)
const directRegistry = resolve(candidate, "registry.json")
const monorepoRegistry = resolve(candidate, "apps/web/public/r/registry.json")
const sourceRoot = await stat(directRegistry)
  .then(() => candidate)
  .catch(async () => {
    await stat(monorepoRegistry)
    return resolve(candidate, "apps/web/public/r")
  })

const publicRoot = resolve(root, "public/r")
const sourceOutput = resolve(root, "registry/learner")
const canonicalBase = "https://cursare.com/r/v0/"
const publicBase = "https://cursare.github.io/ui/r/v0/"

function publicArtifact(raw: string): string {
  const artifact = JSON.parse(raw) as RegistryItem
  artifact.homepage = artifact.homepage?.replace(
    "https://cursare.com",
    "https://cursare.github.io/ui/",
  )
  if (artifact.registryDependencies) {
    artifact.registryDependencies = artifact.registryDependencies.map((dependency) =>
      dependency.replace(canonicalBase, publicBase),
    )
  }
  if (artifact.items) {
    for (const item of artifact.items) {
      item.registryDependencies = item.registryDependencies?.map((dependency) =>
        dependency.replace(canonicalBase, publicBase),
      )
    }
  }
  return `${JSON.stringify(artifact, null, 2)}\n`
}

function sourcePath(target: string): string {
  const prefix = "@components/cursare/"
  if (!target.startsWith(prefix)) throw new Error(`Unexpected registry target: ${target}`)
  return target.slice(prefix.length)
}

await rm(publicRoot, { recursive: true, force: true })
await rm(sourceOutput, { recursive: true, force: true })
await mkdir(resolve(publicRoot, "v0"), { recursive: true })
await mkdir(sourceOutput, { recursive: true })

const expectedFiles = new Set(["registry.json", ...itemNames.map((name) => `${name}.json`)])
const actualFiles = new Set(
  (await readdir(sourceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name),
)
for (const file of expectedFiles) {
  if (!actualFiles.has(file)) throw new Error(`Canonical registry is missing ${file}`)
}

for (const file of [...expectedFiles].sort()) {
  const artifact = publicArtifact(await readFile(resolve(sourceRoot, file), "utf8"))
  await writeFile(resolve(publicRoot, file), artifact)
  await writeFile(resolve(publicRoot, "v0", file), artifact)
}
await cp(resolve(publicRoot, "registry.json"), resolve(root, "registry.json"))

const sources = new Map<string, string>()
for (const name of itemNames) {
  const item = JSON.parse(
    await readFile(resolve(publicRoot, `${name}.json`), "utf8"),
  ) as RegistryItem
  for (const file of item.files ?? []) {
    const path = sourcePath(file.target)
    const existing = sources.get(path)
    if (existing !== undefined && existing !== file.content) {
      throw new Error(`Registry items disagree on ${path}`)
    }
    sources.set(path, file.content)
  }
}

for (const [path, content] of [...sources].sort(([left], [right]) => left.localeCompare(right))) {
  const destination = resolve(sourceOutput, path)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, content)
}

console.log(`Synced ${itemNames.length} learner registry items and ${sources.size} source files.`)
