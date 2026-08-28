# Contributing

Changes should stay reusable and independent from Cursare product or business logic.

1. Change files under `src`.
2. Run `bun run registry:generate` whenever imports or files change.
3. Run `bun run registry:build`, `bun run registry:smoke`, and `bun run check`.
4. Open a focused pull request describing behavior and compatibility impact.

Breaking changes require a major version. New components and backward-compatible APIs
require a minor version. Fixes require a patch version.
