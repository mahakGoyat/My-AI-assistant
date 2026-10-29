---
name: Vercel API entrypoint
description: Deployment-specific guidance for the Express API entrypoint in this Vercel multi-service workspace.
---

Point the Vercel API service entrypoint at a committed Express source file relative to the service root, such as `src/app.ts`, and ensure it default-exports the app. Do not point the service at a generated `dist/*` file: Vercel checks that the entrypoint exists before running `buildCommand`.

**Why:** A Vercel deployment failed with `ENTRYPOINT_NOT_FOUND` because the configured `dist/app.mjs` was only created by `buildCommand`, after Vercel had already validated the entrypoint. Vercel's Express framework supports a default-exported `src/app.ts`.

**How to apply:** Keep service root and entrypoint path aligned; verify the source path exists in the checked-in tree before deployment. After redeploy, check `/api/healthz`. If the build succeeds but runtime still reports `FUNCTION_INVOCATION_FAILED`, inspect Vercel Runtime Logs before further code changes.
