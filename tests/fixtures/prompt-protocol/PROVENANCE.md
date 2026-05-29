# Provenance — Klipper Macro Prompt Protocol fixtures

**Source:** https://github.com/mrmees/klipper-macro-prompt-protocol
**File:** `fixtures/fixtures.json`
**Vendored:** 2026-05-28
**Source commit SHA:** `e11351a4df96b1652e9c166326b76d97ceb33c1b`

## Why this is vendored, not consumed live

Tests must be deterministic and runnable offline. We copy the protocol's
fixture corpus at design time and bump on protocol-repo updates.

## Update procedure

When the protocol repo's `fixtures/fixtures.json` changes:

1. Re-run the curl command from `docs/plans/2026-05-28-macro-prompt-protocol-v1-plan.md` Task 15 step 1.
2. Update the SHA in this file (step 2 of that task).
3. Re-run `corepack pnpm test:unit -- prompt-protocol` and fix any regressions.
4. Commit with `chore(prompt): bump fixtures to <short-sha>`.

If a regression reveals a genuine Fluidd impl gap, file a follow-up task in
the active plan rather than masking the failure.
