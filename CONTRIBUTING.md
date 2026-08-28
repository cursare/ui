# Contributing

Learner component source is maintained in `packages/learning/blocks` in the Cursare
monorepo. Generated source under `registry/learner` must not be edited by hand.

1. Change and validate the canonical learner package.
2. Run `bun run registry:sync <path-to-cursare>` in this repository.
3. Run `bun run check`.
4. Open a focused pull request with the generated diff.

Documentation and publishing fixes may be proposed directly here. Dashboard, admin,
authoring and generic application components are out of scope.
