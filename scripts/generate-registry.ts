import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { basename, dirname, extname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

type PackageJson = {
  dependencies: Record<string, string>
}

type RegistryFile = {
  path: string
  type: "registry:hook" | "registry:lib" | "registry:ui"
  target: string
}

type RegistryItem = {
  name: string
  type: "registry:hook" | "registry:item" | "registry:lib" | "registry:ui"
  title: string
  description: string
  dependencies?: string[]
  registryDependencies?: string[]
  files?: RegistryFile[]
  docs?: string
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
) as PackageJson
const checkOnly = process.argv.includes("--check")
const generatedRoot = resolve(root, "registry")

if (!checkOnly) {
  await rm(generatedRoot, { recursive: true, force: true })
}

function title(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function packageName(specifier: string) {
  const parts = specifier.split("/")
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
}

function internalItem(specifier: string) {
  if (specifier === "@cursare/ui/lib/utils") return "utils"
  const match = specifier.match(/^@cursare\/ui\/(?:components|hooks)\/(.+)$/)
  return match?.[1] ?? null
}

function imports(source: string) {
  return [...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)].map(
    (match) => match[1],
  )
}

function registrySource(source: string) {
  return source
    .replaceAll("@cursare/ui/components/", "@/components/ui/")
    .replaceAll("@cursare/ui/hooks/", "@/hooks/")
    .replaceAll("@cursare/ui/lib/", "@/lib/")
}

async function generatedFile(
  directory: "components" | "hooks" | "lib" | "styles",
  file: string,
  source: string,
) {
  const outputDirectory = directory === "components" ? "ui" : directory
  const relativePath = `registry/${outputDirectory}/${file}`
  const target = resolve(root, relativePath)
  const content = directory === "styles" ? source : registrySource(source)

  if (checkOnly) {
    const current = await readFile(target, "utf8").catch(() => "")
    if (current !== content) {
      console.error(`${relativePath} is stale. Run bun run registry:generate.`)
      process.exitCode = 1
    }
  } else {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }

  return relativePath
}

async function itemFromFile(
  directory: "components" | "hooks" | "lib",
  file: string,
): Promise<RegistryItem> {
  const name = basename(file, extname(file))
  const source = await readFile(resolve(root, `src/${directory}/${file}`), "utf8")
  const registryPath = await generatedFile(directory, file, source)
  const imported = imports(source)
  const registryDependencies = [...new Set(imported.map(internalItem).filter(Boolean))]
    .sort()
    .map((dependency) => `cursare/ui/${dependency}`)
  const dependencies = [
    ...new Set(
      imported
        .filter((specifier) => !specifier.startsWith("@cursare/ui/"))
        .map(packageName)
        .filter((dependency) => dependency in packageJson.dependencies),
    ),
  ]
    .sort()
    .map((dependency) => `${dependency}@${packageJson.dependencies[dependency]}`)
  const type =
    directory === "components"
      ? "registry:ui"
      : directory === "hooks"
        ? "registry:hook"
        : "registry:lib"
  const target =
    directory === "components"
      ? `@ui/${file}`
      : directory === "hooks"
        ? `@hooks/${file}`
        : `@lib/${file}`

  return {
    name,
    type,
    title: title(name),
    description: `${title(name)} for the Cursare UI system.`,
    ...(dependencies.length > 0 ? { dependencies } : {}),
    ...(registryDependencies.length > 0 ? { registryDependencies } : {}),
    files: [
      {
        path: registryPath,
        type,
        target,
      },
    ],
  }
}

async function files(directory: "components" | "hooks" | "lib") {
  return (await readdir(resolve(root, `src/${directory}`)))
    .filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes(".test."))
    .sort()
}

const components = await files("components")
const hooks = await files("hooks")
const libraries = await files("lib")
const items = await Promise.all([
  ...components.map((file) => itemFromFile("components", file)),
  ...hooks.map((file) => itemFromFile("hooks", file)),
  ...libraries.map((file) => itemFromFile("lib", file)),
])
const installableItems = items.map((item) => `cursare/ui/${item.name}`)
const styleSource = await readFile(resolve(root, "src/styles/globals.css"), "utf8")
const stylePath = await generatedFile("styles", "globals.css", styleSource)

items.push(
  {
    name: "style",
    type: "registry:item",
    title: "Cursare Style",
    description: "Cursare's Tailwind CSS v4 design tokens and theme.",
    files: [
      {
        path: stylePath,
        type: "registry:lib",
        target: "@lib/cursare-globals.css",
      },
    ],
    docs: "Import the installed cursare-globals.css file from your application stylesheet.",
  },
  {
    name: "ui",
    type: "registry:item",
    title: "Cursare UI",
    description: "The complete Cursare UI primitive collection.",
    registryDependencies: ["cursare/ui/style", ...installableItems],
    docs: "Install the complete primitive set and import cursare-globals.css from your application stylesheet.",
  },
)

const registry = `${JSON.stringify(
  {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "cursare",
    homepage: "https://cursare.github.io/ui/",
    items,
  },
  null,
  2,
)}\n`
const target = resolve(root, "registry.json")

if (checkOnly) {
  const current = await readFile(target, "utf8").catch(() => "")
  if (current !== registry) {
    console.error("registry.json is stale. Run bun run registry:generate.")
    process.exit(1)
  }
} else {
  await writeFile(target, registry)
}
