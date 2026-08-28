import type { CodeLanguage } from "@/components/cursare/foundation/model"
import { prismHighlighter } from "./prism"

export type SyntaxLanguage = CodeLanguage

export interface SyntaxToken {
  from: number
  to: number
  className: string
}

export interface HighlightedCode {
  language: string
  label: string
  tokens: SyntaxToken[]
}

// The only contract the editor has with a highlighting engine. Tokens are
// transient presentation tokens and never enter the saved document.
export interface SyntaxHighlighter {
  languages: readonly SyntaxLanguage[]
  normalizeLanguage(language: unknown): string
  tokenize(code: string, language: unknown): HighlightedCode
}

// Swapping engines changes this binding and nothing else.
export const syntaxHighlighter: SyntaxHighlighter = prismHighlighter
