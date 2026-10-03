# Project Instructions
 
## Commands
- `bun test` runs the test suite
- `bun run build` builds for production
- `bun run lint` checks code style
 
## Architecture
- Monorepo, packages live in `packages/`
- Each package has its own `tsconfig.json`
- Shared types in `packages/shared/`
 
## Style
- Functional components, no classes
- Named exports, not default
- Error messages must be user-facing
 
## Lessons learned
- Auth middleware must run before rate limiting
- Don't modify migration files directly, generate new ones