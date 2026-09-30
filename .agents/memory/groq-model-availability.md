---
name: Groq model availability
description: Environment-specific handling when a Groq API key cannot access the user-requested model.
---

The configured Groq key may expose a smaller or newer model catalog than the model requested by the product. Preserve the requested model as the primary call, detect a model-unavailable response, and use a documented compatible model only when needed.

**Why:** A valid key can return `model_not_found` for a requested model, which otherwise makes the chatbot appear broken even though the provider is reachable.

Groq requests can also fail transiently after the model fallback is selected. A short server-side retry plus one client retry is appropriate for 408, 429, and 5xx responses, while validation and rate-limit errors should remain immediate.

**How to apply:** Verify the provider's model list without exposing the key, keep the requested model string in the primary request, log the fallback choice without secrets, retry only transient provider failures, and document the behavior for deployment.