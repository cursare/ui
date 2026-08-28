"use client"

import type { LucideIcon } from "lucide-react"
import {
  Download,
  FileArchive,
  FileAudio,
  FileChartColumn,
  FileImage,
  FileText,
  FileVideo,
  Paperclip,
  Presentation,
} from "lucide-react"

export function formatFileAttachmentMetadata(
  size: number | null,
  mime: string | null,
  name: string,
): string {
  const kind = fileKind(mime, name)
  const sizeLabel = fileSize(size)
  return [kind, sizeLabel].filter(Boolean).join(" · ")
}

export function fileAttachmentIcon(mime: string | null, name: string): LucideIcon {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (mime?.startsWith("video/")) return FileVideo
  if (mime?.startsWith("audio/")) return FileAudio
  if (mime?.startsWith("image/")) return FileImage
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return FileArchive
  if (["xls", "xlsx", "csv", "numbers"].includes(ext)) return FileChartColumn
  if (["ppt", "pptx", "key"].includes(ext)) return Presentation
  if (mime === "application/pdf" || ["pdf", "doc", "docx", "rtf", "odt"].includes(ext)) {
    return FileText
  }
  return Paperclip
}

export function ReaderFileAttachment({
  url,
  name,
  metadata,
  actionLabel,
  icon: FileIcon,
  onDownload,
}: {
  url: string
  name: string
  metadata: string
  actionLabel: string
  icon?: LucideIcon | null
  onDownload?: () => void
}) {
  return (
    <a
      className="content-file-card"
      data-learner-effect="focus"
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      download={name}
      aria-label={`${actionLabel} ${name}`}
      data-with-icon={FileIcon ? "true" : undefined}
      onClick={onDownload}
    >
      {FileIcon ? (
        <span className="content-file-icon" data-learner-icon="component" aria-hidden>
          <FileIcon />
        </span>
      ) : null}
      <span className="content-file-text">
        <span className="content-file-name">{name}</span>
        {metadata ? <span className="content-file-meta">{metadata}</span> : null}
      </span>
      <span className="content-file-action">
        <span>{actionLabel}</span>
        <Download aria-hidden />
      </span>
    </a>
  )
}

function fileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ""
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const rounded = value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value).toString()
  return `${rounded} ${units[unit]}`
}

function fileKind(mime: string | null, name: string): string {
  const extension = name.split(".").pop()?.trim()
  if (extension && extension !== name && extension.length <= 8) return extension.toUpperCase()
  if (mime === "application/pdf") return "PDF"
  return ""
}
