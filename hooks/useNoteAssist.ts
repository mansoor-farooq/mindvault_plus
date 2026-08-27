import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';

class AiLimitReachedError extends Error {}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || ''); // strip the "data:<mime>;base64," prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function callAi(path: string, token: string, body: object) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error === 'AI_LIMIT_REACHED') {
      throw new AiLimitReachedError("You've hit today's free AI limit for this feature.");
    }
    throw new Error(data.message || data.error || 'AI request failed');
  }
  return data;
}

/** Wraps the Gemini-backed /api/ai/notes/* endpoints for the note-creation pages. */
export function useNoteAssist() {
  const token = useAuthStore((s) => s.token);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTagging, setIsTagging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const handleAiError = (err: unknown) => {
    if (err instanceof AiLimitReachedError) {
      setLimitReached(true);
      setError(err.message);
    } else {
      setError(err instanceof Error ? err.message : 'AI request failed');
    }
  };

  const locale = typeof navigator !== 'undefined' ? navigator.language : undefined;

  const summarize = async (title: string, description: string): Promise<string | null> => {
    if (!token) { setError('Please sync/login first to use AI features.'); return null; }
    setError(null);
    setIsSummarizing(true);
    try {
      const data = await callAi('/api/ai/notes/summarize', token, { title, description, locale });
      return data.summary as string;
    } catch (err) {
      handleAiError(err);
      return null;
    } finally {
      setIsSummarizing(false);
    }
  };

  /** Same as summarize(), but for a voice note's raw recording - Gemini listens to the
   * audio directly rather than requiring a typed transcript first. */
  const summarizeAudio = async (title: string, audioBlob: Blob): Promise<string | null> => {
    if (!token) { setError('Please sync/login first to use AI features.'); return null; }
    setError(null);
    setIsSummarizing(true);
    try {
      const base64 = await blobToBase64(audioBlob);
      const data = await callAi('/api/ai/notes/summarize', token, {
        title,
        audio: { mimeType: audioBlob.type || 'audio/webm', base64 },
        locale,
      });
      return data.summary as string;
    } catch (err) {
      handleAiError(err);
      return null;
    } finally {
      setIsSummarizing(false);
    }
  };

  const suggestTags = async (title: string, description: string): Promise<string[]> => {
    if (!token) { setError('Please sync/login first to use AI features.'); return []; }
    setError(null);
    setIsTagging(true);
    try {
      const data = await callAi('/api/ai/notes/tags', token, { title, description, locale });
      return (data.tags as string[]) || [];
    } catch (err) {
      handleAiError(err);
      return [];
    } finally {
      setIsTagging(false);
    }
  };

  return {
    summarize, summarizeAudio, suggestTags, isSummarizing, isTagging, error, limitReached,
    clearError: () => { setError(null); setLimitReached(false); },
  };
}
