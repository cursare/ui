# Contributing

This registry accepts Cursare-owned components composed from official COSS primitives.
Do not copy COSS primitives into this repository.

1. Add or change files under `src/components` or `src/hooks`.
2. Use existing COSS primitives through `@cursare/ui/components/<name>` imports.
3. Add synchronized files to `sync-manifest.json` when the private monorepo needs them.
4. Run `bun run check`.
5. Open a focused pull request describing behavior and compatibility impact.

Breaking changes require a major version. New components and backward-compatible APIs
require a minor version. Fixes require a patch version.
