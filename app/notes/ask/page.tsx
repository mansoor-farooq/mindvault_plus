"use client";

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import AdModal from '@/components/AdModal';
import { ArrowLeft, Sparkles, Loader2, Send } from 'lucide-react';
import Link from 'next/link';

export default function AskNotesPage() {
  const token = useAuthStore((s) => s.token);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [sourceNotes, setSourceNotes] = useState<{ id: string; title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);

  const allNotes = useLiveQuery(() => db.notes.filter(n => !n.isDeleted).toArray());

  const handleAsk = async () => {
    if (!question.trim() || question.trim().length < 3) return;
    if (!token) {
      setError('Please sync/login first to use Ask MindVault.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setLimitReached(false);
    setAnswer(null);
    try {
      const res = await fetch(`/api/ai/notes/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, locale: typeof navigator !== 'undefined' ? navigator.language : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'AI_LIMIT_REACHED') {
          setLimitReached(true);
          throw new Error("You've hit today's free AI limit for this feature.");
        }
        throw new Error(data.message || data.error || 'Failed to get an answer');
      }
      setAnswer(data.answer);
      const ids: string[] = data.sourceNoteIds || [];
      const titles = (allNotes || [])
        .filter(n => n.syncId && ids.includes(n.syncId))
        .map(n => ({ id: n.syncId!, title: n.title }));
      setSourceNotes(titles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 flex items-center justify-between shadow-lg shadow-indigo-200/50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> Ask MindVault
          </h1>
        </div>
      </header>

      <div className="flex-1 p-4 max-w-2xl w-full mx-auto flex flex-col gap-4">
        <p className="text-sm text-gray-500">
          Ask a question about your own notes. {allNotes ? `You have ${allNotes.length} note${allNotes.length === 1 ? '' : 's'} saved.` : ''}
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="e.g. What did the landlord say about rent?"
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleAsk}
            disabled={isLoading || question.trim().length < 3}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl p-3 flex items-center gap-2 flex-wrap">
            <span>{error}</span>
            {limitReached && (
              <button
                type="button"
                onClick={() => setShowAdModal(true)}
                className="font-bold text-indigo-600 underline"
              >
                Watch an ad for +5
              </button>
            )}
          </div>
        )}

        {answer && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-purple-600">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Answer</span>
            </div>
            <p className="text-gray-700 leading-relaxed">{answer}</p>
            {sourceNotes.length > 0 && (
              <div className="pt-3 mt-1 border-t border-gray-100">
                <p className="text-[11px] text-gray-400 mb-2">Based on:</p>
                <div className="flex flex-wrap gap-2">
                  {sourceNotes.map(n => (
                    <span key={n.id} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                      {n.title || 'Untitled'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AdModal isOpen={showAdModal} onClose={() => { setShowAdModal(false); setLimitReached(false); setError(null); }} featureKey="ai_notes_assist" />
    </main>
  );
}
