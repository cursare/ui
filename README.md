# Cursare UI

Public registry for components designed by Cursare and composed from the official
[COSS UI](https://coss.com/ui/) primitives. COSS primitives stay upstream; this
repository only contains Cursare-owned extensions.

## Components

- `date-picker` — localized ISO date selection
- `date-range-picker` — localized ranges with presets and limits
- `phone-input` — international phone input with country selection
- `settings-toggle` — immediate-save settings row with loading state
- `use-media-query` — SSR-safe responsive hook

Browse the hosted registry at [cursare.github.io/ui](https://cursare.github.io/ui/).

## Install

Install one component directly:

```bash
bunx shadcn@latest add cursare/ui/date-picker
```

Or configure the hosted namespace:

```bash
bunx shadcn@latest registry add @cursare=https://cursare.github.io/ui/r/{name}.json
bunx shadcn@latest add @cursare/date-picker
```

Install every Cursare extension plus the COSS style foundation:

```bash
bunx shadcn@latest add cursare/ui/ui
```

Transitive primitives such as `Button`, `Calendar`, `Popover`, `Frame`, and `Switch`
are installed from `@coss`; their source is not duplicated here.

## Development

```bash
bun install
bun run check
```

`registry.json` is generated from the source import graph. Imports from
`@cursare/ui/components/<primitive>` become `@coss/<primitive>` registry dependencies,
while imports between Cursare extensions stay inside this registry.

## Releases and private synchronization

GitHub releases are the immutable synchronization boundary for the private Cursare
monorepo. `sync-manifest.json` lists the Cursare-owned files that may be overlaid into
the private package; upstream COSS primitives are never deleted or mirrored.

## License

MIT. See [LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
