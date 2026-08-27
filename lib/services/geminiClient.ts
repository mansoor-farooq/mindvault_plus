const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const TIMEOUT_MS = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '', 10) || 30000;
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface GenerateOptions {
  image?: { mimeType: string; base64: string };
  audio?: { mimeType: string; base64: string };
  jsonMode?: boolean;
}

// Multi-Key Key Pool
function getApiKeys(): string[] {
  const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return keysStr.split(',').map((k) => k.trim()).filter(Boolean);
}

let currentKeyIndex = 0;

function getNextApiKey(): string {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new GeminiError('GEMINI_NOT_CONFIGURED', 'No GEMINI_API_KEY or GEMINI_API_KEYS configured');
  }
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return key;
}

/**
 * Calls Gemini's generateContent REST API with multi-key load balancing.
 * Supports text, images (OCR), and audio (voice notes).
 */
export async function generateText(prompt: string, { image, audio, jsonMode }: GenerateOptions = {}): Promise<string> {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new GeminiError('GEMINI_NOT_CONFIGURED', 'GEMINI_API_KEY is not set');
  }

  const parts: Record<string, unknown>[] = [{ text: prompt }];

  if (image) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
  }

  if (audio) {
    parts.push({ inline_data: { mime_type: audio.mimeType, data: audio.base64 } });
  }

  const body: Record<string, unknown> = {
    contents: [{ parts }],
  };

  if (jsonMode) {
    body.generationConfig = { responseMimeType: 'application/json' };
  }

  // Attempt request with automatic failover across keys
  let lastError: unknown;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const apiKey = getNextApiKey();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        // If rate limited or quota error, try next key
        if (res.status === 429 || res.status === 503) {
          console.warn(`Gemini key rate limited (${res.status}), trying next key...`);
          lastError = new GeminiError('GEMINI_RATE_LIMIT', `Key rate limited: ${errBody}`);
          continue;
        }
        throw new GeminiError('GEMINI_ERROR', `Gemini API error ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      const text: string =
        data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text)
          .filter(Boolean)
          .join('') || '';

      if (!text) {
        throw new GeminiError('GEMINI_EMPTY_RESPONSE', 'Gemini returned empty text');
      }

      return text;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new GeminiError('GEMINI_TIMEOUT', 'Gemini request timed out');
      }
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new GeminiError('GEMINI_UNAVAILABLE', String(lastError));
}
