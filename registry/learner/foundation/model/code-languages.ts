export const CODE_LANGUAGES = [
  { value: "plaintext", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "jsx", label: "JSX" },
  { value: "tsx", label: "TSX" },
  { value: "python", label: "Python" },
  { value: "json", label: "JSON" },
  { value: "markup", label: "HTML / XML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "bash", label: "Bash / Shell" },
  { value: "sql", label: "SQL" },
  { value: "graphql", label: "GraphQL" },
  { value: "java", label: "Java" },
  { value: "kotlin", label: "Kotlin" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "docker", label: "Dockerfile" },
] as const

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]
export type CodeLanguageValue = CodeLanguage["value"]

const languageValues = new Set<string>(CODE_LANGUAGES.map(({ value }) => value))

const CODE_LANGUAGE_ALIASES: Readonly<Record<string, CodeLanguageValue>> = {
  "c#": "csharp",
  "c++": "cpp",
  cs: "csharp",
  dockerfile: "docker",
  gql: "graphql",
  golang: "go",
  html: "markup",
  js: "javascript",
  json5: "json",
  kt: "kotlin",
  md: "markdown",
  node: "javascript",
  plain: "plaintext",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  text: "plaintext",
  ts: "typescript",
  txt: "plaintext",
  xml: "markup",
  yml: "yaml",
  zsh: "bash",
}

export function normalizeCodeLanguage(language: unknown): CodeLanguageValue {
  if (typeof language !== "string") return "plaintext"
  const value = language.trim().toLowerCase()
  const normalized = CODE_LANGUAGE_ALIASES[value] ?? value
  return languageValues.has(normalized) ? (normalized as CodeLanguageValue) : "plaintext"
}
