# Cursare Learner UI

Public source registry for the learner-facing surfaces rendered by Cursare. It does
not contain dashboard, admin, authoring or generic Cursare application components.

The browsable installed source is under [`registry/learner`](./registry/learner).
The hosted catalog is available at [cursare.github.io/ui](https://cursare.github.io/ui/).

## Learner components

- `course-card`
- `course-catalog`
- `learner-home`
- `curriculum-journey`
- `enrolled-course-home`
- `course-player`
- `cursare-course-player` — loads published learner-safe content from the Cursare API by id
- `course-shell`
- `course-outline`
- `study-tools`
- `intake-form`
- `blocks` — the complete learner platform

`learner-foundation` and `learner-runtime` are internal registry dependencies installed
automatically when a surface needs them.

## Install

Add the hosted namespace to `components.json`:

```json
{
  "registries": {
    "@cursare": "https://cursare.github.io/ui/r/{name}.json"
  }
}
```

Install the complete learner platform:

```bash
bunx shadcn@4.14.0 add @cursare/blocks
```

Or install one focused surface:

```bash
bunx shadcn@4.14.0 add @cursare/course-card
```

For API-backed delivery, install the server adapter:

```bash
bunx shadcn@4.14.0 add @cursare/cursare-course-player
```

Configure the organization API key once in trusted server code, then pages only need the
content id:

```tsx
import {
  createCursareCoursePlayer,
} from "@/components/cursare/cursare-course-player"

const apiKey = process.env.CURSARE_API_KEY
if (!apiKey) throw new Error("CURSARE_API_KEY is required")
export const CursarePlayer = createCursareCoursePlayer({ apiKey })

export default function CoursePage() {
  return <CursarePlayer contentId="content-id" />
}
```

The key is sent only from the server to `GET /api/v1/contents/{id}/learner`; never expose it
through a public browser environment variable.

Without configuring a namespace, use the item URL directly:

```bash
bunx shadcn@4.14.0 add https://cursare.github.io/ui/r/blocks.json
```

Import the learner styles once:

```css
@import "./components/cursare/styles.css";
@import "./components/cursare/composer/viewer/styles.css";
```

## COSS and shadcn compatibility

The catalog uses the shadcn registry protocol and CLI. Required COSS/Base UI
primitives are included as source dependencies of each learner item, so consumers do
not need a second registry and keep full ownership of the installed code.

## Development

```bash
bun install
bun run check
```

The Cursare monorepo is canonical. This repository contains the generated registry
artifacts plus a materialized, browsable view of their source.

## Synchronization

From this repository, export the current learner registry from a local Cursare
checkout and validate the exact consumer installation:

```bash
bun run registry:sync ../cursare
bun run check
```

The automated workflow uses the same command. Synchronization only flows from the
canonical Cursare learner packages into this public distribution.

## License

MIT. See [LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
