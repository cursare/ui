import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { basename, dirname, extname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

type PackageJson = {
  dependencies: Record<string, string>
}

type RegistryFile = {
  path: string
  type: "registry:hook" | "registry:ui"
  target: string
}

type RegistryItem = {
  name: string
  type: "registry:hook" | "registry:item" | "registry:ui"
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
const builtRoot = resolve(root, "public/r")

const cossComponents = new Set([
  "accordion",
  "alert",
  "alert-dialog",
  "autocomplete",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "calendar",
  "card",
  "checkbox",
  "checkbox-group",
  "collapsible",
  "combobox",
  "command",
  "context-menu",
  "dialog",
  "drawer",
  "empty",
  "field",
  "fieldset",
  "form",
  "frame",
  "group",
  "input",
  "input-group",
  "kbd",
  "label",
  "menu",
  "meter",
  "number-field",
  "otp-field",
  "pagination",
  "popover",
  "preview-card",
  "progress",
  "radio-group",
  "scroll-area",
  "select",
  "separator",
  "sheet",
  "sidebar",
  "skeleton",
  "slider",
  "spinner",
  "switch",
  "table",
  "tabs",
  "textarea",
  "toast",
  "toggle",
  "toggle-group",
  "toolbar",
  "tooltip",
])

const descriptions: Record<string, string> = {
  "date-picker": "Localized date picker with ISO date-string values.",
  "date-range-picker": "Localized date-range picker with presets and bounded ranges.",
  "phone-input": "International phone input with localized country selection.",
  "settings-toggle": "Immediate-save settings row with loading state.",
  "use-media-query": "SSR-safe responsive media-query hook.",
}

if (!checkOnly) {
  await Promise.all([
    rm(generatedRoot, { recursive: true, force: true }),
    rm(builtRoot, { recursive: true, force: true }),
  ])
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

function registryDependency(specifier: string) {
  if (specifier === "@cursare/ui/lib/utils") return null

  const match = specifier.match(/^@cursare\/ui\/(components|hooks)\/(.+)$/)
  if (!match) return null

  const [, directory, name] = match
  if (directory === "components" && cossComponents.has(name)) {
    return `@coss/${name}`
  }

  return `cursare/ui/${name}`
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
  directory: "components" | "hooks",
  file: string,
  source: string,
) {
  const outputDirectory = directory === "components" ? "ui" : directory
  const relativePath = `registry/${outputDirectory}/${file}`
  const target = resolve(root, relativePath)
  const content = registrySource(source)

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
  directory: "components" | "hooks",
  file: string,
): Promise<RegistryItem> {
  const name = basename(file, extname(file))
  const source = await readFile(resolve(root, `src/${directory}/${file}`), "utf8")
  const registryPath = await generatedFile(directory, file, source)
  const imported = imports(source)
  const registryDependencies = [
    ...new Set(imported.map(registryDependency).filter((item): item is string => Boolean(item))),
  ].sort()
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
  const type = directory === "components" ? "registry:ui" : "registry:hook"
  const target = directory === "components" ? `@ui/${file}` : `@hooks/${file}`

  return {
    name,
    type,
    title: title(name),
    description: descriptions[name] ?? `${title(name)} for Cursare applications.`,
    ...(dependencies.length > 0 ? { dependencies } : {}),
    ...(registryDependencies.length > 0 ? { registryDependencies } : {}),
    files: [{ path: registryPath, type, target }],
  }
}

async function files(directory: "components" | "hooks") {
  return (await readdir(resolve(root, `src/${directory}`)))
    .filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes(".test."))
    .sort()
}

const components = await files("components")
const duplicatedPrimitives = components
  .map((file) => basename(file, extname(file)))
  .filter((name) => cossComponents.has(name))

if (duplicatedPrimitives.length > 0) {
  throw new Error(
    `COSS primitives must remain upstream: ${duplicatedPrimitives.join(", ")}`,
  )
}

const hooks = await files("hooks")
const items = await Promise.all([
  ...components.map((file) => itemFromFile("components", file)),
  ...hooks.map((file) => itemFromFile("hooks", file)),
])
const installableItems = items.map((item) => `cursare/ui/${item.name}`)

items.push({
  name: "ui",
  type: "registry:item",
  title: "Cursare UI",
  description: "The complete Cursare extension set for COSS UI.",
  registryDependencies: ["@coss/style", ...installableItems],
  docs: "Installs Cursare's composed components while resolving primitives from the official COSS registry.",
})

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
