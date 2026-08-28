import { CODE_LANGUAGES, normalizeCodeLanguage } from "@/components/cursare/foundation/model"
import Prism from "prismjs"
import "prismjs/components/prism-bash"
import "prismjs/components/prism-c"
import "prismjs/components/prism-cpp"
import "prismjs/components/prism-csharp"
import "prismjs/components/prism-docker"
import "prismjs/components/prism-go"
import "prismjs/components/prism-graphql"
import "prismjs/components/prism-java"
import "prismjs/components/prism-json"
import "prismjs/components/prism-kotlin"
import "prismjs/components/prism-markdown"
import "prismjs/components/prism-markup-templating"
import "prismjs/components/prism-php"
import "prismjs/components/prism-python"
import "prismjs/components/prism-ruby"
import "prismjs/components/prism-rust"
import "prismjs/components/prism-scss"
import "prismjs/components/prism-sql"
import "prismjs/components/prism-swift"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-tsx"
import "prismjs/components/prism-yaml"
import type { HighlightedCode, SyntaxHighlighter, SyntaxToken } from "./syntax-highlighter"

// Tokens are rendered by the host, so Prism v1's browser auto-run must not touch
// the source DOM.
Prism.manual = true

const languages = CODE_LANGUAGES

function inferredLanguage(code: string) {
  const source = code.trim()
  if (!source) return "plaintext"

  if (/^#!.*\b(?:ba|z)?sh\b/m.test(source)) return "bash"
  if (/^(?:FROM|RUN|COPY|ADD|WORKDIR|ENTRYPOINT|CMD|EXPOSE|ENV)\b/m.test(source)) return "docker"

  if (/^[{[]/.test(source)) {
    try {
      JSON.parse(source)
      return "json"
    } catch {}
  }

  if (/^<\/?[a-z][\s\S]*>/i.test(source)) return "markup"
  if (/^(?:query|mutation|subscription|fragment)\b/m.test(source)) return "graphql"
  if (/^(?:SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im.test(source)) return "sql"
  if (/^(?:package\s+main|func\s+\w+\s*\()/m.test(source)) return "go"
  if (/^(?:fn\s+\w+|let\s+mut\b|impl\s+\w+|use\s+\w+::)|println!/m.test(source)) return "rust"
  if (/^(?:def\s+\w+|from\s+\S+\s+import\b|class\s+\w+.*:|print\s*\()/m.test(source)) {
    return "python"
  }
  if (/^(?:\$\s*)?(?:bun|npm|npx|pnpm|yarn|git|curl|docker|cd|mkdir|export)\b/m.test(source)) {
    return "bash"
  }
  if (
    /\b(?:interface|enum|namespace)\s+\w+|\bimport\s+type\b|\bas\s+const\b|:\s*(?:string|number|boolean)\b/.test(
      source,
    )
  ) {
    return "typescript"
  }
  if (
    /\b(?:const|let|var|function|class|import|export|await)\b|\b(?:if|for|while|switch|catch)\s*\(|=>|===|!==|\?\.|\bBun\./.test(
      source,
    )
  ) {
    return "javascript"
  }
  if (/^[^{\n]+\{[\s\S]*\b[-a-z]+\s*:\s*[^;{}]+;/im.test(source)) return "css"
  if (/^(?:---\s*$|[\w.-]+:\s+\S+)/m.test(source)) return "yaml"

  return "plaintext"
}

function tokenLength(token: string | Prism.Token | Array<string | Prism.Token>): number {
  if (typeof token === "string") return token.length
  if (Array.isArray(token)) return token.reduce((length, child) => length + tokenLength(child), 0)
  return tokenLength(token.content)
}

function appendTokens(
  stream: string | Prism.Token | Array<string | Prism.Token>,
  offset: number,
  inheritedClasses: string[],
  tokens: SyntaxToken[],
): number {
  if (typeof stream === "string") {
    const to = offset + stream.length
    if (stream.length > 0 && inheritedClasses.length > 0) {
      tokens.push({
        from: offset,
        to,
        className: `token ${[...new Set(inheritedClasses)].join(" ")}`,
      })
    }
    return to
  }

  if (Array.isArray(stream)) {
    return stream.reduce(
      (position, child) => appendTokens(child, position, inheritedClasses, tokens),
      offset,
    )
  }

  const aliases = Array.isArray(stream.alias) ? stream.alias : stream.alias ? [stream.alias] : []
  const classes = [...inheritedClasses, stream.type, ...aliases]
  const end = appendTokens(stream.content, offset, classes, tokens)

  // Some third-party grammars emit a content stream that doesn't reproduce the
  // matched source length.
  return Math.max(end, offset + tokenLength(stream.content))
}

function addBashCommandTokens(code: string, tokens: SyntaxToken[]) {
  for (const match of code.matchAll(/(^|\n)([\t ]*(?:\$[\t ]*)?)([a-zA-Z_][\w.-]*)/g)) {
    const command = match[3]
    if (!command || match.index === undefined) continue
    const from = match.index + (match[1]?.length ?? 0) + (match[2]?.length ?? 0)
    const to = from + command.length
    if (tokens.some((token) => token.from < to && token.to > from)) continue
    tokens.push({ from, to, className: "token function" })
  }
  tokens.sort((left, right) => left.from - right.from)
}

function tokenize(code: string, language: unknown): HighlightedCode {
  const explicit = typeof language === "string" && language.trim().length > 0
  const normalized = explicit ? normalizeCodeLanguage(language) : inferredLanguage(code)
  const descriptor = languages.find(({ value }) => value === normalized) ?? CODE_LANGUAGES[0]
  const grammar = Prism.languages[normalized]
  if (!grammar || normalized === "plaintext" || code.length === 0) {
    return { language: normalized, label: descriptor.label, tokens: [] }
  }

  const tokens: SyntaxToken[] = []
  appendTokens(Prism.tokenize(code, grammar), 0, [], tokens)
  if (normalized === "bash") addBashCommandTokens(code, tokens)
  return { language: normalized, label: descriptor.label, tokens }
}

export const prismHighlighter: SyntaxHighlighter = {
  languages,
  normalizeLanguage: normalizeCodeLanguage,
  tokenize,
}
