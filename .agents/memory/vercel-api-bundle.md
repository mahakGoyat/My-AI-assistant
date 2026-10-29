---
name: Vercel API bundle
description: Deployment-specific guidance for the Express API in this Vercel multi-service workspace.
---

Keep the Vercel API service pointed at a generated, self-contained Express bundle, and keep its build command and entrypoint aligned.

**Why:** The live service returned `FUNCTION_INVOCATION_FAILED` even on its health endpoint. A locally built bundle imported and served health successfully; the external runtime stack was not available here, so bundling is a mitigation, not a confirmed diagnosis.

**How to apply:** Verify `/api/healthz` after redeploy. If Vercel still reports a function invocation failure, inspect its Runtime Logs before making further code changes.
