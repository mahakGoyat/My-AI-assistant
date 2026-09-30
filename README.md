# My AI Assistant

My AI Assistant is a responsive, full-stack chatbot with a plain HTML/CSS/JavaScript frontend and an Express backend. It streams answers from Groq's `llama-3.3-70b-versatile` model and keeps the current browser's conversations in local storage. If a Groq key does not have access to that model, the server uses the available `openai/gpt-oss-120b` compatibility model so the app remains usable.

## Features

- ChatGPT-style conversation UI with user and assistant messages
- Streaming responses over `POST /api/chat`
- Conversation context sent with every request
- Hindi and Hinglish support through the assistant system prompt
- Lightweight markdown rendering with fenced code blocks and Copy buttons
- Local chat history, New Chat, retry, and light/dark mode
- Responsive mobile layout with a history drawer
- Server-side input validation and in-memory rate limiting

## Local setup

1. Install Node.js 20+ and pnpm.
2. Install workspace dependencies:

   ```bash
   pnpm install
   ```

3. Add `GROQ_API_KEY` to Replit Secrets (or your local environment). The key is read only by the Express API server and is never sent to the browser.
4. Start the API server:

   ```bash
   pnpm --filter @workspace/api-server run dev
   ```

5. In a second terminal, start the frontend:

   ```bash
   pnpm --filter @workspace/my-ai-assistant run dev
   ```

The Replit preview routes `/api/*` to the API server and `/` to the frontend automatically.

## API

`POST /api/chat`

```json
{
  "messages": [
    { "role": "user", "content": "Explain closures in JavaScript." }
  ]
}
```

The response uses `text/event-stream`. Each event contains a JSON object such as `{ "content": "next text chunk" }`; the stream ends with `data: [DONE]`.

The server accepts up to 50 messages per request and limits each message to 12,000 characters. It allows 20 requests per minute per client IP in the in-memory limiter.

## Verification

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/my-ai-assistant run typecheck
pnpm --filter @workspace/my-ai-assistant run build
```

## Deployment

Publish the Replit project after adding `GROQ_API_KEY` to the production Secrets environment. The frontend is built as static assets, while the managed API server runs the Express backend.
