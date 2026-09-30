import { Router, type IRouter, type Request } from "express";
import Groq from "groq-sdk";
import { StreamChatBody } from "@workspace/api-zod";

const router: IRouter = Router();

const MODEL = "llama-3.3-70b-versatile";
const COMPATIBILITY_MODEL = "openai/gpt-oss-120b";
const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Answer clearly and accurately. Always identify the language and script of the user's latest message and reply in that same language: English questions get natural English answers; Hindi questions get Hindi answers in Devanagari; Hinglish questions get Hinglish answers in the same Latin-script style. Do not switch languages unless the user asks you to. Keep technical terms in English when that is natural for Hinglish or Hindi.";
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 12_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const requestLog = new Map<string, number[]>();

function getClientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.ip || "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(key, recent);
    return true;
  }

  recent.push(now);
  requestLog.set(key, recent);
  return false;
}

function isModelUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: number; code?: string };
  return candidate.status === 404 || candidate.code === "model_not_found";
}

router.post("/chat", async (req, res): Promise<void> => {
  if (isRateLimited(getClientKey(req))) {
    res.status(429).json({
      error: "You’re sending messages too quickly. Please wait a moment and try again.",
    });
    return;
  }

  const parsed = StreamChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Please send a valid conversation with messages under 12,000 characters.",
    });
    return;
  }

  const { messages } = parsed.data;
  if (
    messages.length > MAX_MESSAGES ||
    messages.some((message) => message.content.length > MAX_MESSAGE_LENGTH)
  ) {
    res.status(400).json({
      error: "This conversation is too long. Start a new chat and try again.",
    });
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    req.log.error("GROQ_API_KEY is not configured");
    res.status(503).json({
      error: "The assistant is not configured yet. Please try again later.",
    });
    return;
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const request = (model: string) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      });

    let stream;
    try {
      stream = await request(MODEL);
    } catch (error) {
      if (!isModelUnavailable(error)) throw error;
      req.log.warn(
        { requestedModel: MODEL, fallbackModel: COMPATIBILITY_MODEL },
        "Requested Groq model is unavailable; using compatibility model",
      );
      stream = await request(COMPATIBILITY_MODEL);
    }

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    req.log.error({ err: error }, "Groq chat request failed");
    if (!res.headersSent) {
      res.status(502).json({
        error: "I couldn’t reach the assistant right now. Please try again.",
      });
      return;
    }

    res.write(
      `data: ${JSON.stringify({ error: "I couldn’t finish that response. Please try again." })}\n\n`,
    );
    res.end();
  }
});

export default router;