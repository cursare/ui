# Cursare UI

Reusable React UI primitives used by Cursare. The components are built on Base UI,
Tailwind CSS v4, and the COSS component model.

## Install from the shadcn registry

Install directly from this public GitHub registry:

```bash
bunx shadcn@latest add cursare/ui/button
```

Or configure the hosted namespace:

```bash
bunx shadcn@latest registry add @cursare=https://cursare.github.io/ui/r/{name}.json
bunx shadcn@latest add @cursare/button
```

Install the complete primitive set:

```bash
bunx shadcn@latest add cursare/ui/ui
```

After installing the style item, import `cursare-globals.css` from your application
stylesheet.

## Package source

The same source is versioned as a package and can be installed from GitHub:

```bash
bun add github:cursare/ui#v0.1.1
```

```tsx
import { Button } from "@cursare/ui/components/button"
```

Publishing `@cursare/ui` to npm is prepared in the release workflow and starts after
the Cursare npm scope configures the repository's `NPM_TOKEN` secret.

## Development

```bash
bun install
bun run registry:build
bun run registry:smoke
bun run check
```

`registry.json` is generated from the source import graph. Component dependencies and
registry dependencies must not be maintained by hand.

## Releases

1. Update the package version.
2. Merge the change and create a matching GitHub release such as `v0.2.0`.
3. The release workflow validates the repository and publishes `@cursare/ui` when the
   `NPM_TOKEN` repository secret is configured.

## License

MIT. See [LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
