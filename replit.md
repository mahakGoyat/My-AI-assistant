# My AI Assistant

My AI Assistant is a responsive, browser-persisted chatbot powered by streamed Groq responses.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required secret: `GROQ_API_KEY` — used only by the API server

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/my-ai-assistant/src/main.ts` — vanilla browser UI, streaming client, localStorage, markdown rendering
- `artifacts/my-ai-assistant/src/index.css` — responsive light/dark visual system
- `artifacts/api-server/src/routes/chat.ts` — Groq streaming route, validation, system prompt, rate limiting
- `lib/api-spec/openapi.yaml` — chat API contract

## Architecture decisions

- The frontend uses browser DOM APIs and fetch streaming rather than a UI framework.
- Chat history is intentionally browser-local; no conversation content is stored on the server.
- Groq is called only from Express so `GROQ_API_KEY` never reaches the client.
- The API sends Server-Sent Event frames over a regular POST response to support incremental rendering.

## Product

Users can ask general knowledge, coding, study, career, and writing questions, switch themes, start fresh chats, revisit browser-local history, and copy generated code.

## User preferences

- Keep the frontend clean HTML/CSS/JavaScript without a heavy UI framework.

## Gotchas

- Add `GROQ_API_KEY` before starting the API workflow.
- The rate limiter is in-memory and resets when the API process restarts.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
