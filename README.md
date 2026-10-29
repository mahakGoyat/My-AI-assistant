# My AI Assistant

A quiet place to think. A personal AI chat assistant that answers questions on learning, code, career and writing, and keeps your conversation history in your browser. No login and no database.

**Live demo:** [my-ai-assistant-rho-eight.vercel.app](https://my-ai-assistant-rho-eight.vercel.app)

## Features

- Ask questions and get AI answers, powered by the Groq API
- Chat history is saved in your browser, so past conversations appear in the sidebar
- Start a new chat at any time with the New chat button
- Starter prompts for common tasks: understand an idea, build a project, make a study plan, improve your writing
- Press Enter to send and Shift + Enter for a new line
- No account needed

## Tech Stack

| Part | Tools |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query, Framer Motion, shadcn/ui (Radix UI) |
| Backend | Node.js, Express 5, Groq SDK, Pino |
| API layer | OpenAPI spec with generated Zod schemas and React client |
| Tooling | pnpm workspaces, esbuild |
| Hosting | Vercel |
| Built with | Replit |

## Project Structure

```
My-AI-assistant/
├── artifacts/
│   ├── my-ai-assistant/   # React frontend
│   └── api-server/        # Express backend (Groq)
├── lib/
│   ├── api-spec/          # OpenAPI specification
│   ├── api-zod/           # Generated Zod schemas
│   └── api-client-react/  # Generated React API client
└── scripts/
```

## Getting Started

You need Node.js and [pnpm](https://pnpm.io) installed, and a free API key from [Groq](https://console.groq.com).

```bash
git clone https://github.com/mahakGoyat/My-AI-assistant.git
cd My-AI-assistant
pnpm install
```

Create a `.env` file for the backend:

```
GROQ_API_KEY=your_groq_api_key
```

Start the backend and the frontend in two terminals:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/my-ai-assistant run dev
```

## Environment Variables

| Variable | Used by | Description |
| --- | --- | --- |
| `GROQ_API_KEY` | Backend | API key from console.groq.com |

Never commit your real API key. Add it as an environment variable in your hosting dashboard (for example, Vercel).

## Deployment

The app is deployed on Vercel. Add `GROQ_API_KEY` under Project Settings, Environment Variables, then redeploy.

## Author

Built by **Mahak Goyat**
[GitHub](https://github.com/mahakGoyat) · [LinkedIn](https://www.linkedin.com/in/mahak-goyat)
