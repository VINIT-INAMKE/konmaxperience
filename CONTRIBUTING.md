# Contributing

## Toolchain
- Node 22 (`backend/.node-version`, `frontend/.nvmrc`). Both packages declare `"engines": { "node": ">=22" }`.
- Install: `cd backend && npm ci` (runs `prisma generate`), `cd frontend && npm ci`.

## Git hooks (no husky)
Hooks live in `.githooks/`. Enable once per clone:

    git config core.hooksPath .githooks

`pre-push` runs `tsc --noEmit` in both packages and blocks the push on type errors.
Skip in an emergency with `git push --no-verify` (CI will still fail).

## Checks CI runs on every push / PR (`.github/workflows/ci.yml`)
Backend: `npm ci` → `npx prisma generate` → `npm run lint:check` → `npx tsc --noEmit -p tsconfig.json` → `npx jest --ci --silent` → `npm run build`.
Frontend: `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm run build`.
Run the same commands locally before opening a PR. `npm run lint` in backend applies `--fix`; `lint:check` is the read-only gate.

## Tests
- Unit specs live next to the code (`*.spec.ts`, jest rootDir `backend/src`).
- Use `backend/src/test-utils/mock-providers.ts` for Nest providers (`mockPrisma`, `providePusher`, `provideEventEmitter`, ...). Spec follows service: when a constructor gains a dependency, add the provider; never weaken the service.
- `npm run test:e2e` needs a database (`DATABASE_URL`); it is not part of CI yet.

## Lint policy
Type-unsafety (`no-unsafe-*`), React Compiler diagnostics and Prettier formatting are **warnings** for now; hard errors (unused vars, rules-of-hooks, prefer-const) block CI. Do not add new warnings in files you touch.
