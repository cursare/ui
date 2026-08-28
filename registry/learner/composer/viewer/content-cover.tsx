"use client"

import { type ImgHTMLAttributes, useState } from "react"

export interface ContentCoverMediaProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "className" | "src" | "style"> {
  src?: string | null
  alt?: string
  className?: string
  contentSlot?: string
  imageClassName?: string
}

export interface ContentCoverAttributionProps {
  creatorName?: string | null
  creatorUrl?: string | null
  sourceUrl?: string | null
  photoByLabel?: string
  onLabel?: string
}

function safeUnsplashUrl(value?: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "unsplash.com" ? url.toString() : null
  } catch {
    return null
  }
}

export function ContentCoverAttribution({
  creatorName,
  creatorUrl,
  sourceUrl,
  photoByLabel = "Photo by",
  onLabel = "on",
}: ContentCoverAttributionProps) {
  const creatorHref = safeUnsplashUrl(creatorUrl)
  const sourceHref = safeUnsplashUrl(sourceUrl)
  if (!creatorName || !creatorHref || !sourceHref) return null

  return (
    <span className="content-cover-attribution">
      {photoByLabel}{" "}
      <a href={creatorHref} target="_blank" rel="noreferrer">
        {creatorName}
      </a>{" "}
      {onLabel}{" "}
      <a href={sourceHref} target="_blank" rel="noreferrer">
        Unsplash
      </a>
    </span>
  )
}

export function ContentCoverMedia({
  src,
  alt = "",
  className,
  contentSlot = "content-cover-media",
  imageClassName,
  onError,
  ...imageProps
}: ContentCoverMediaProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showsImage = Boolean(src && failedSrc !== src)

  return (
    <span
      data-slot={contentSlot}
      data-content-cover-kind={showsImage ? "image" : "fallback"}
      className={`content-cover-media ${className ?? ""}`}
    >
      <span className="content-cover-fallback" aria-hidden />
      {showsImage ? (
        <img
          {...imageProps}
          src={src ?? undefined}
          alt={alt}
          className={imageClassName}
          onError={(event) => {
            setFailedSrc(src ?? null)
            onError?.(event)
          }}
        />
      ) : null}
    </span>
  )
}
