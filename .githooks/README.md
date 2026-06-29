# Repo Git Hooks

This repo includes optional git hooks under `.githooks/`.

To enable:

```bash
git config core.hooksPath .githooks
```

Current hooks:
- `pre-commit`: blocks committing mutable runtime state (`envoy-runtime/traffic_split/*`).
