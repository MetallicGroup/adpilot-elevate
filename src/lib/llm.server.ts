/**
 * Central LLM layer — Anthropic Claude (server-only).
 *
 * Toate apelurile de text/agent trec pe aici. Reads ANTHROPIC_API_KEY from env.
 * Generarea de imagini și transcrierea audio NU se fac aici (Claude nu le face) —
 * vezi wa-ai-extras.server.ts (OpenAI: gpt-image-1 + Whisper).
 */
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

/**
 * Modelele centrale. Schimbă aici dacă ai acces la alte versiuni.
 *  - chat: conversații WhatsApp, suport, copy, landing (echilibru calitate/preț)
 *  - reasoning: optimizarea reclamelor (mai deștept, mai scump)
 */
export const LLM = {
  chat: "claude-sonnet-5",
  reasoning: "claude-opus-4-8",
} as const;

/** Modelul (obiect AI SDK) pentru agentul cu tool-calling și conversații. */
export function chatModel() {
  return anthropic(LLM.chat);
}

/** Modelul de raționament pentru analiza/optimizarea reclamelor. */
export function reasoningModel() {
  return anthropic(LLM.reasoning);
}

/**
 * Apel simplu text → text pe Claude. Întoarce textul răspunsului (trimmed).
 * Înlocuiește vechiul `askAi` care lovea gateway-ul Lovable.
 */
export async function askClaude(
  system: string,
  user: string,
  opts?: { model?: string },
): Promise<string> {
  const { text } = await generateText({
    model: anthropic(opts?.model ?? LLM.chat),
    system,
    prompt: user,
  });
  return text.trim();
}
