import { db } from '../db.server';

const STOPWORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'i', 'my', 'me', 'this', 'that', 'with', 'do', 'does', 'did', 'what', 'when', 'where', 'how', 'who']);

function tokenize(text: string): string[] {
  return (text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

interface RetrievedNote {
  id: string;
  title: string;
  description: string;
  summary: string | null;
  created_at: string;
}

/**
 * v1 RAG: no vector DB / embeddings - pulls the user's recent notes, then
 * re-ranks by keyword overlap with the question in plain JS. Good enough at
 * this data scale; embeddings are a clear upgrade path if note volume grows.
 */
export async function findRelevantNotes(userId: number, question: string, limit = 5): Promise<RetrievedNote[]> {
  const result = await db.query(
    `SELECT frontend_id as id, title, description, summary, created_at
     FROM notes WHERE user_id = $1 AND is_deleted = false
     ORDER BY created_at DESC LIMIT 100`,
    [userId]
  );

  const queryTerms = tokenize(question).filter((t) => !STOPWORDS.has(t));

  const scored = result.rows.map((note: RetrievedNote) => {
    const noteTerms = new Set(tokenize(`${note.title} ${note.description} ${note.summary || ''}`));
    const overlap = queryTerms.filter((t) => noteTerms.has(t)).length;
    return { note, score: overlap };
  });

  scored.sort((a, b) => b.score - a.score);

  // If nothing matched by keyword, fall back to most recent notes rather than nothing.
  const top = scored.some((s) => s.score > 0) ? scored.filter((s) => s.score > 0) : scored;
  return top.slice(0, limit).map((s) => s.note);
}
