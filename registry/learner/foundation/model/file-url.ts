export type FileUrlResult =
  | { status: "supported"; name: string; url: string }
  | { status: "invalid" }

const DOWNLOAD_FILE_EXTENSION = /\.(?:csv|docx|json|md|pdf|pptx|txt|xlsx|zip)$/i

export function resolveFileUrl(raw: string): FileUrlResult {
  const value = raw.trim()
  if (!value || value.length > 2_048 || value.startsWith("//")) return { status: "invalid" }
  try {
    const parsed = value.startsWith("/")
      ? new URL(value, "https://cursare.invalid")
      : new URL(value)
    if (
      (!value.startsWith("/") && parsed.protocol !== "https:") ||
      !DOWNLOAD_FILE_EXTENSION.test(parsed.pathname)
    ) {
      return { status: "invalid" }
    }
    const name = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).at(-1) ?? "")
    if (!name) return { status: "invalid" }
    return { status: "supported", name, url: value.startsWith("/") ? value : parsed.href }
  } catch {
    return { status: "invalid" }
  }
}
