# Release process

Three packages are published from this repo:

1. `@fluid/core`
2. `@fluid/engine`  (depends on `@fluid/core`)
3. `@fluid/react`   (depends on `@fluid/core` and `@fluid/engine`)

`@fluid/db` and `@fluid/telemetry` stay `"private": true` for now.

## Publish sequence

```bash
# 1. Build all three packages.
bun run build:packages

# 2. Bump versions if needed.
#    Edit packages/*/package.json — keep all three in lockstep for v0.1.x.

# 3. Dry-run first (catches missing files, wrong exports, scope-403).
cd packages/fluid-core   && npm publish --access public --dry-run && cd -
cd packages/fluid-engine && npm publish --access public --dry-run && cd -
cd packages/fluid-react  && npm publish --access public --dry-run && cd -

# 4. Real publish. ORDER MATTERS — core first because engine and react depend on it.
cd packages/fluid-core   && npm publish --access public && cd -
cd packages/fluid-engine && npm publish --access public && cd -
cd packages/fluid-react  && npm publish --access public && cd -

# 5. Tag and push.
git tag v0.1.0 && git push --tags
```

`workspace:*` dependencies get rewritten to the current sibling version by `bun publish` / `npm publish`. If a published package still resolves a `workspace:*` literal, hand-edit `dependencies` before `npm publish` and try again.

## `@fluid` scope ownership

We have not verified that the `@fluid` scope is publishable under our account. The first dry-run will tell us:

- ✅ **`200 OK`** — proceed.
- ❌ **`E403 You do not have permission to publish "@fluid/core"`** — fall back to a scope we own. Create an npm org (e.g. `fluid-ui`), then rename:
  ```bash
  find packages apps demo-app -name package.json -not -path '*/node_modules/*' \
    -exec sed -i '' 's|@fluid/|@fluid-ui/|g' {} +
  grep -rl '@fluid/' packages apps demo-app --include='*.ts' --include='*.tsx' \
    | xargs sed -i '' 's|@fluid/|@fluid-ui/|g'
  bun install
  ```
  Then re-run from step 1.

## Verifying with a fresh consumer

After publish (or with locally-packed tarballs via `npm pack`), install all three into a fresh `bun create next-app` outside this repo, mount `<FluidProvider>` + `<FluidView>` + `<FluidChat>`, and confirm:

- Module resolves under both Webpack and Turbopack
- Types are picked up (hover a `FluidProvider` prop in the IDE)
- ESM in a server component, CJS in a Node test runner — both load
