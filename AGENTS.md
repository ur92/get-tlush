# Agent instructions (tlush)

This repo uses **Spec-Driven Design**. Start here:

1. [specs/constitution.md](specs/constitution.md) — binding decisions
2. [specs/README.md](specs/README.md) — SDD rules, SPEC.md template, validation commands
3. [.cursor/rules/spec-driven-design.mdc](.cursor/rules/spec-driven-design.mdc) — Cursor rule (always on)

## Quick commands

```bash
yarn spec:validate
yarn test:contract
yarn test
yarn build
yarn workspace @tlush/web dev
```

## Layout

| Path | Purpose |
| ---- | ------- |
| `specs/` | Source of truth — do not skip when changing behavior |
| `packages/` | All TypeScript code including `@tlush/web` |
| `tests/contract/` | Spec compliance tests |
| `infra/` | AWS setup scripts |

## PR discipline

Spec → fixture → test → code. If you change behavior, update the matching `SPEC.md` and fixtures in the same PR.
