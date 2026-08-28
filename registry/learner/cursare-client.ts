import type { ParsedContentDocument } from "@/components/cursare/foundation/model/learner-runtime"

export interface CursareLearnerContent {
  id: string
  routeSegment: string
  title: string
  description: string | null
  coverImage: string | null
  theme: string | null
  publishedAt: string | null
  document: ParsedContentDocument
}

export interface CursareClient {
  getLearnerContent(contentId: string): Promise<CursareLearnerContent>
}

export type CursareFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface CursareServerClientOptions {
  apiKey: string
  baseUrl?: string
  fetch?: CursareFetch
}

export class CursareApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "CursareApiError"
    this.status = status
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseLearnerContent(value: unknown): CursareLearnerContent {
  const data = record(value)
  const document = record(data?.document)
  if (
    typeof data?.id !== "string" ||
    typeof data.routeSegment !== "string" ||
    typeof data.title !== "string" ||
    document?.type !== "doc" ||
    (document.content !== undefined && !Array.isArray(document.content))
  ) {
    throw new CursareApiError("Cursare returned an invalid learner content response.", 502)
  }
  return data as unknown as CursareLearnerContent
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function createCursareServerClient({
  apiKey,
  baseUrl = "https://app.cursare.com/api/v1",
  fetch: fetchRequest = globalThis.fetch,
}: CursareServerClientOptions): CursareClient {
  if (typeof window !== "undefined") {
    throw new Error("createCursareServerClient must only be called from trusted server code.")
  }
  const credential = apiKey.trim()
  if (!credential) throw new Error("A Cursare API key is required.")
  if (typeof fetchRequest !== "function") throw new Error("A Fetch implementation is required.")
  const endpoint = baseUrl.replace(/\/+$/, "")

  return {
    async getLearnerContent(contentId) {
      const id = contentId.trim()
      if (!id) throw new Error("A Cursare content id is required.")
      const response = await fetchRequest(
        `${endpoint}/contents/${encodeURIComponent(id)}/learner`,
        {
          method: "GET",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${credential}`,
          },
          cache: "no-store",
        },
      )
      const body = await responseBody(response)
      if (!response.ok) {
        const error = record(body)?.error
        throw new CursareApiError(
          typeof error === "string" ? error : `Cursare API request failed (${response.status}).`,
          response.status,
        )
      }
      return parseLearnerContent(record(body)?.data)
    },
  }
}
