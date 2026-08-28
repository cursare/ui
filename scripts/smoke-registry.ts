import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

type RegistryItem = { registryDependencies?: string[] }

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const artifacts = await mkdtemp(resolve(tmpdir(), "cursare-registry-artifacts-"))
const fixture = await mkdtemp(resolve(tmpdir(), "cursare-registry-consumer-"))
const publicBase = /^https:\/\/cursare\.github\.io\/ui\/r\/v\d+\//

async function run(command: string[], cwd: string) {
  const child = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed\n${stdout}\n${stderr}`)
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const name = new URL(request.url).pathname.slice(1)
    if (!/^[a-z0-9-]+\.json$/.test(name)) return new Response("Not found", { status: 404 })
    try {
      return new Response(await readFile(resolve(artifacts, name)), {
        headers: { "content-type": "application/json; charset=utf-8" },
      })
    } catch {
      return new Response("Not found", { status: 404 })
    }
  },
})

try {
  const localBase = `http://127.0.0.1:${server.port}/`
  for (const name of await Array.fromAsync(
    new Bun.Glob("*.json").scan({ cwd: resolve(root, "public/r"), onlyFiles: true }),
  )) {
    const item = JSON.parse(await readFile(resolve(root, "public/r", name), "utf8")) as RegistryItem
    item.registryDependencies = item.registryDependencies?.map((dependency) =>
      dependency.replace(publicBase, localBase),
    )
    await writeJson(resolve(artifacts, name), item)
  }

  await writeJson(resolve(fixture, "package.json"), {
    name: "cursare-learner-registry-smoke",
    private: true,
    type: "module",
    scripts: { build: "vite build", check: "tsc --noEmit" },
    dependencies: {
      "class-variance-authority": "0.7.1",
      clsx: "2.1.1",
      react: "19.0.0",
      "react-dom": "19.0.0",
      "tailwind-merge": "3.6.0",
    },
    devDependencies: {
      "@tailwindcss/vite": "4.3.3",
      "@types/node": "26.1.2",
      "@types/react": "19.2.18",
      "@types/react-dom": "19.2.4",
      "@vitejs/plugin-react": "5.0.2",
      tailwindcss: "4.3.3",
      typescript: "5.9.3",
      vite: "7.1.4",
    },
  })
  await writeJson(resolve(fixture, "components.json"), {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "base-nova",
    rsc: false,
    tsx: true,
    tailwind: { config: "", css: "src/styles.css", baseColor: "neutral", cssVariables: true },
    iconLibrary: "lucide",
    aliases: {
      components: "@/components",
      hooks: "@/hooks",
      lib: "@/lib",
      utils: "@/lib/utils",
      ui: "@/components/ui",
    },
  })
  await writeJson(resolve(fixture, "tsconfig.json"), {
    compilerOptions: {
      baseUrl: ".",
      esModuleInterop: true,
      jsx: "react-jsx",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "Bundler",
      noEmit: true,
      paths: { "@/*": ["./src/*"] },
      skipLibCheck: true,
      strict: true,
      target: "ES2022",
      types: ["vite/client"],
    },
    include: ["src", "vite.config.ts"],
  })
  await mkdir(resolve(fixture, "src/lib"), { recursive: true })
  await writeFile(
    resolve(fixture, "src/lib/utils.ts"),
    `import { type ClassValue, clsx } from "clsx"\nimport { twMerge } from "tailwind-merge"\n\nexport function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }\n`,
  )
  await writeFile(
    resolve(fixture, "vite.config.ts"),
    `import { fileURLToPath, URL } from "node:url"\nimport react from "@vitejs/plugin-react"\nimport tailwindcss from "@tailwindcss/vite"\nimport { defineConfig } from "vite"\n\nexport default defineConfig({ plugins: [react(), tailwindcss()], resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } } })\n`,
  )
  await writeFile(
    resolve(fixture, "index.html"),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
  )
  await writeFile(
    resolve(fixture, "src/main.tsx"),
    `import * as apiPlayer from "@/components/cursare/cursare-course-player"\nimport * as card from "@/components/cursare/course-card"\nimport * as player from "@/components/cursare/course-player"\nimport "./styles.css"\n\nconst root = document.querySelector<HTMLDivElement>("#root")\nif (root) root.dataset.exports = String(Object.keys(apiPlayer).length + Object.keys(card).length + Object.keys(player).length)\n`,
  )
  await writeFile(
    resolve(fixture, "src/styles.css"),
    `@import "tailwindcss";\n@import "./components/cursare/styles.css";\n@import "./components/cursare/composer/viewer/styles.css";\n@source "./components/**/*.{ts,tsx}";\n`,
  )

  await run(["bun", "install"], fixture)
  await run(
    ["bunx", "shadcn@4.14.0", "add", `${localBase}blocks.json`, "--yes", "--overwrite"],
    fixture,
  )
  await readFile(resolve(fixture, "src/components/cursare/course-card.tsx"))
  await readFile(resolve(fixture, "src/components/cursare/course-player.tsx"))
  await readFile(resolve(fixture, "src/components/cursare/cursare-course-player.tsx"))
  await readFile(resolve(fixture, "src/components/cursare/composer/viewer/index.ts"))
  await run(["bun", "run", "check"], fixture)
  await run(["bun", "run", "build"], fixture)
  console.log("Consumer smoke passed: COSS/Base UI source through the shadcn CLI.")
} finally {
  server.stop(true)
  await rm(artifacts, { recursive: true, force: true })
  await rm(fixture, { recursive: true, force: true })
}
