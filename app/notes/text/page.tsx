"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { suggestNoteTags } from '@/lib/smartSuggestions';
import { useNoteAssist } from '@/hooks/useNoteAssist';
import AdModal from '@/components/AdModal';
import { ArrowLeft, Save, Tag, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = ['Business', 'Meeting', 'Study', 'Personal', 'Event'];

export default function TextNote() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal');
  const [tags, setTags] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const { summarize, suggestTags: aiSuggestTags, isSummarizing, isTagging, error: aiError, limitReached, clearError } = useNoteAssist();

  const suggestedTags = useMemo(() => suggestNoteTags(title, description), [title, description]);
  const canUseAi = description.trim().length >= 10;

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleAiSummarize = async () => {
    clearError();
    const result = await summarize(title, description);
    if (result) setSummary(result);
  };

  const handleAiTags = async () => {
    clearError();
    const result = await aiSuggestTags(title, description);
    if (result.length > 0) setTags(prev => Array.from(new Set([...prev, ...result])));
  };

  const handleSave = async () => {
    if (!title && !description) return;

    setIsSaving(true);
    try {
      await db.notes.add({
        title,
        description,
        type: 'TEXT',
        category,
        tags,
        summary: summary || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        isDeleted: false,
      });
      router.push('/');
    } catch (err) {
      console.error('Failed to save note', err);
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white/80 backdrop-blur-xl p-4 flex justify-between items-center border-b border-gray-100 sticky top-0 z-10">
        <Link href="/" className="p-2 -ml-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="font-semibold text-lg">New Note</h1>
        <button
          onClick={handleSave}
          disabled={isSaving || (!title && !description)}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-bold px-3.5 py-1.5 rounded-full hover:bg-indigo-700 disabled:opacity-40 disabled:bg-gray-300 transition-colors"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 animate-fade-in-up">
        <input
          type="text"
          placeholder="Note Title"
          className="w-full text-2xl font-bold bg-transparent border-none outline-none placeholder:text-gray-300"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                category === cat
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <textarea
          placeholder="Start typing your thoughts..."
          className="flex-1 w-full bg-transparent border-none outline-none resize-none placeholder:text-gray-400 text-gray-700 text-lg leading-relaxed mt-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {(suggestedTags.length > 0 || tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            <Tag className="w-3.5 h-3.5 text-gray-400" />
            {Array.from(new Set([...tags, ...suggestedTags])).map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  tags.includes(tag)
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {canUseAi && (
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAiSummarize}
                disabled={isSummarizing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-100 disabled:opacity-50"
              >
                {isSummarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Summarize
              </button>
              <button
                type="button"
                onClick={handleAiTags}
                disabled={isTagging}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-100 disabled:opacity-50"
              >
                {isTagging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI Tags
              </button>
            </div>
            {aiError && (
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-rose-500">{aiError}</p>
                {limitReached && (
                  <button
                    type="button"
                    onClick={() => setShowAdModal(true)}
                    className="text-xs font-bold text-indigo-600 underline"
                  >
                    Watch an ad for +5
                  </button>
                )}
              </div>
            )}
            {summary && (
              <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3">
                <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wide mb-1">AI Summary</p>
                <p className="text-xs text-gray-600">{summary}</p>
              </div>
            )}
          </div>
        )}
      </main>

      <AdModal isOpen={showAdModal} onClose={() => { setShowAdModal(false); clearError(); }} featureKey="ai_notes_assist" />
    </div>
  );
}
