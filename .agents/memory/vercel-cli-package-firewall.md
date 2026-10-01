---
name: Vercel CLI package firewall
description: A Replit package-firewall constraint encountered while trying to run Vercel's local multi-service CLI.
---

Installing the current Vercel CLI through `pnpm dlx` was blocked by the Replit package firewall when it denied a transitive `tar` package request. Do not work around the firewall by switching registries or fetching packages manually.

**Why:** The attempted local integration test could not launch the CLI, even though the app's own typechecks, builds, and route checks passed.

**How to apply:** If the same block occurs, report the limitation, validate `vercel.json` against Vercel's published schema, and run the service builds and available route checks; use `vercel dev` later when the CLI can be installed through the approved package path.