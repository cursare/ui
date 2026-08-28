import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixture = await mkdtemp(resolve(tmpdir(), "cursare-ui-registry-"))

try {
  await mkdir(resolve(fixture, "src/styles"), { recursive: true })
  await writeFile(
    resolve(fixture, "package.json"),
    `${JSON.stringify({ name: "registry-smoke", private: true }, null, 2)}\n`,
  )
  await writeFile(
    resolve(fixture, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          baseUrl: ".",
          jsx: "react-jsx",
          module: "ESNext",
          moduleResolution: "Bundler",
          paths: { "@/*": ["./src/*"] },
          target: "ES2022",
        },
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
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(resolve(fixture, "src/styles/globals.css"), '@import "tailwindcss";\n')

  const item = resolve(root, "public/r/button.json")
  const process = Bun.spawn(
    ["bunx", "shadcn@4.16.2", "add", item, "--yes", "--overwrite"],
    { cwd: fixture, stdout: "pipe", stderr: "pipe" },
  )
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ])
  if (exitCode !== 0) {
    throw new Error(`Registry installation failed.\n${stdout}\n${stderr}`)
  }

  const installed = await readFile(resolve(fixture, "src/components/ui/button.tsx"), "utf8")
  if (!installed.includes('from "@/lib/utils"')) {
    throw new Error(`Registry installation did not rewrite package aliases.\n${installed}`)
  }
} finally {
  await rm(fixture, { recursive: true, force: true })
}
