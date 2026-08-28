import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

type Registry = {
  items: Array<{ name: string; registryDependencies?: string[] }>
}

type RegistryItem = {
  registryDependencies?: string[]
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixture = await mkdtemp(resolve(tmpdir(), "cursare-ui-registry-"))
const localRegistry = resolve(fixture, "registry")
const itemNames = [
  "date-picker",
  "date-range-picker",
  "phone-input",
  "settings-toggle",
  "use-media-query",
  "ui",
]

async function run(command: string[], cwd: string) {
  const child = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])

  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed.\n${stdout}\n${stderr}`)
  }
}

try {
  const registry = JSON.parse(
    await readFile(resolve(root, "registry.json"), "utf8"),
  ) as Registry
  const actualNames = registry.items.map((item) => item.name).sort()
  const expectedNames = [...itemNames].sort()

  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `Registry exposes unexpected items.\nExpected: ${expectedNames.join(", ")}\nActual: ${actualNames.join(", ")}`,
    )
  }

  await Promise.all([
    mkdir(resolve(fixture, "src/styles"), { recursive: true }),
    mkdir(localRegistry, { recursive: true }),
  ])

  for (const name of itemNames) {
    const item = JSON.parse(
      await readFile(resolve(root, `public/r/${name}.json`), "utf8"),
    ) as RegistryItem
    item.registryDependencies = item.registryDependencies?.map((dependency) => {
      if (!dependency.startsWith("cursare/ui/")) return dependency
      const dependencyName = dependency.slice("cursare/ui/".length)
      return resolve(localRegistry, `${dependencyName}.json`)
    })
    await writeFile(
      resolve(localRegistry, `${name}.json`),
      `${JSON.stringify(item, null, 2)}\n`,
    )
  }

  await writeFile(
    resolve(fixture, "package.json"),
    `${JSON.stringify(
      {
        name: "registry-smoke",
        private: true,
        dependencies: {
          react: "^19.2.4",
          "react-dom": "^19.2.4",
        },
        devDependencies: {
          "@types/bun": "1.3.14",
          "@types/react": "^19.2.18",
          "@types/react-dom": "^19.2.4",
          tailwindcss: "^4.3.3",
          typescript: "^5.9.3",
        },
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    resolve(fixture, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          baseUrl: ".",
          esModuleInterop: true,
          jsx: "react-jsx",
          lib: ["DOM", "DOM.Iterable", "ES2022"],
          module: "ESNext",
          moduleResolution: "Bundler",
          noEmit: true,
          paths: { "@/*": ["./src/*"] },
          skipLibCheck: true,
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    resolve(fixture, "components.json"),
    `${JSON.stringify(
      {
        $schema: "https://ui.shadcn.com/schema.json",
        style: "base-nova",
        rsc: true,
        tsx: true,
        tailwind: {
          config: "",
          css: "src/styles/globals.css",
          baseColor: "neutral",
          cssVariables: true,
        },
        iconLibrary: "lucide",
        aliases: {
          components: "@/components",
          utils: "@/lib/utils",
          hooks: "@/hooks",
          lib: "@/lib",
          ui: "@/components/ui",
        },
        registries: {
          "@coss": "https://coss.com/ui/r/{name}.json",
        },
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    resolve(fixture, "src/styles/globals.css"),
    '@import "tailwindcss";\n',
  )

  await run(["bun", "install"], fixture)
  await run(
    [
      "bunx",
      "shadcn@4.16.2",
      "add",
      resolve(localRegistry, "ui.json"),
      "--yes",
      "--overwrite",
    ],
    fixture,
  )

  for (const component of itemNames.filter(
    (name) => !["ui", "use-media-query"].includes(name),
  )) {
    await readFile(resolve(fixture, `src/components/ui/${component}.tsx`), "utf8")
  }
  await readFile(resolve(fixture, "src/components/ui/button.tsx"), "utf8")
  await readFile(resolve(fixture, "src/hooks/use-media-query.ts"), "utf8")

  await cp(
    resolve(root, "tests/registry.test.ts"),
    resolve(fixture, "src/registry.test.ts"),
  )
  await run(["bun", "test", "src/registry.test.ts"], fixture)
  await run(["bunx", "tsc", "--noEmit"], fixture)
} finally {
  await rm(fixture, { recursive: true, force: true })
}
