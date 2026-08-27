'use client';
import { use, useState, useRef, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import { SyncService } from '@/services/SyncService';
import AdModal from '@/components/AdModal';
import { useNoteAssist, blobToBase64 } from '@/hooks/useNoteAssist';
import Link from 'next/link';
import { ArrowLeft, Loader2, Send, Lock, Sparkles, Mic, Square } from 'lucide-react';

export default function NoteDetailPage({ params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = use(params);
  const { token, featureAccess } = useAuthStore();
  const note = useLiveQuery(() => db.notes.where('syncId').equals(noteId).first(), [noteId]);
  const messages = useLiveQuery(() => db.chatMessages.where('noteId').equals(noteId).sortBy('createdAt'), [noteId]);

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  // Voice notes store their recording as a local Blob until SyncService uploads it and
  // fills in voicePath (a server-relative /uploads/... path). Prefer the local Blob when
  // present (works immediately, before upload finishes); fall back to voicePath otherwise.
  const audioObjectUrl = useMemo(() => {
    if (note?.type === 'VOICE' && note.audioBlob) {
      return URL.createObjectURL(note.audioBlob);
    }
    return null;
  }, [note?.type, note?.audioBlob]);

  useEffect(() => {
    return () => {
      if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    };
  }, [audioObjectUrl]);

  const audioSrc = audioObjectUrl || note?.voicePath || null;

  const isGated = featureAccess ? featureAccess['notes_ai'] === false : false;
  // Voice messaging is a stricter, separate gate from text chat - it's only unlocked by
  // real paid status or an explicit admin grant, never by the ad-boosted quota that text
  // chat can fall back on (see lib/featureAccess.ts's 'notes_voice_chat' entry).
  const isVoiceChatGated = featureAccess ? featureAccess['notes_voice_chat'] === false : false;

  const { summarizeAudio, isSummarizing, error: summarizeError, limitReached: summarizeLimitReached, clearError: clearSummarizeError } = useNoteAssist();
  const [showSummarizeAdModal, setShowSummarizeAdModal] = useState(false);

  const handleSummarizeAudio = async () => {
    if (!note || !audioSrc) return;
    clearSummarizeError();
    try {
      // note.audioBlob covers the common case (recorded on this device, not yet reloaded
      // from a fresh sync pull); otherwise fetch the uploaded copy from voicePath.
      const blob = note.audioBlob ? note.audioBlob : await fetch(audioSrc).then((r) => r.blob());
      const result = await summarizeAudio(note.title, blob);
      if (result) {
        await db.notes.where('syncId').equals(noteId).modify({ summary: result, updatedAt: new Date() });
        SyncService.sync();
      }
    } catch {
      // summarizeAudio already captured any AI error into summarizeError; a blob-fetch
      // failure here just leaves the summary unset, nothing further to do.
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !note || !note.syncId || !token) return;
    const userText = input.trim();
    setInput('');
    setError(null);
    setLimitReached(false);
    setIsSending(true);
    try {
      const priorHistory = (messages || []).map((m) => ({ role: m.role, content: m.content }));

      await db.chatMessages.add({ noteId, role: 'user', content: userText, createdAt: new Date() });

      const res = await fetch('/api/ai/notes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          note: { title: note.title, category: note.category, tags: note.tags, summary: note.summary, description: note.description },
          history: priorHistory,
          message: userText,
          locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'AI_LIMIT_REACHED') {
          setLimitReached(true);
          throw new Error("You've hit today's free AI limit for this feature.");
        }
        throw new Error(data.message || data.error || 'Failed to get a reply');
      }

      await db.chatMessages.add({ noteId, role: 'assistant', content: data.reply, createdAt: new Date() });
      SyncService.sync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSending(false);
    }
  };

  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [voiceGatedNotice, setVoiceGatedNotice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleMicClick = async () => {
    if (isVoiceChatGated) {
      setVoiceGatedNotice(true);
      return;
    }
    if (isRecordingVoice) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsRecordingVoice(false);
        handleSendVoiceMessage(blob);
      };
      recorder.start();
      setIsRecordingVoice(true);
    } catch {
      setError('Microphone access is required to send a voice message.');
    }
  };

  const handleSendVoiceMessage = async (blob: Blob) => {
    if (!note || !note.syncId || !token || blob.size === 0) return;
    setError(null);
    setLimitReached(false);
    setIsSendingVoice(true);
    try {
      const priorHistory = (messages || []).map((m) => ({ role: m.role, content: m.content }));
      const base64 = await blobToBase64(blob);

      const res = await fetch('/api/ai/notes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          note: { title: note.title, category: note.category, tags: note.tags, summary: note.summary, description: note.description },
          history: priorHistory,
          audio: { mimeType: blob.type || 'audio/webm', base64 },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'FEATURE_NOT_AVAILABLE') {
          setVoiceGatedNotice(true);
          throw new Error('Voice chat is a premium feature.');
        }
        if (data.error === 'AI_LIMIT_REACHED') {
          setLimitReached(true);
          throw new Error("You've hit today's free AI limit for this feature.");
        }
        throw new Error(data.message || data.error || 'Failed to process the voice message');
      }

      await db.chatMessages.add({ noteId, role: 'user', content: data.transcript, createdAt: new Date() });
      await db.chatMessages.add({ noteId, role: 'assistant', content: data.reply, createdAt: new Date(Date.now() + 1) });
      SyncService.sync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSendingVoice(false);
    }
  };

  if (note === undefined) return null; // loading

  if (!note) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-gray-500">Note not found.</p>
        <Link href="/" className="text-indigo-600 font-semibold hover:underline">Back to home</Link>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 flex items-center gap-3 shadow-lg shadow-indigo-200/50 sticky top-0 z-10">
        <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-white" />
        </Link>
        <h1 className="text-xl font-bold tracking-wide truncate">{note.title || 'Untitled'}</h1>
      </header>

      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto">
        <div className="p-4 flex flex-col gap-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-wrap text-xs font-medium">
            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">{note.category}</span>
            {note.tags?.map((t) => (
              <span key={t} className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{t}</span>
            ))}
          </div>
          {note.type === 'VOICE' && (
            audioSrc ? (
              <div className="flex flex-col gap-2">
                <audio controls src={audioSrc} className="w-full h-11" />
                {!note.summary && !isGated && (
                  <button
                    type="button"
                    onClick={handleSummarizeAudio}
                    disabled={isSummarizing}
                    className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-100 disabled:opacity-50"
                  >
                    {isSummarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Summarize Recording
                  </button>
                )}
                {summarizeError && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-rose-500">{summarizeError}</p>
                    {summarizeLimitReached && (
                      <button type="button" onClick={() => setShowSummarizeAdModal(true)} className="text-xs font-bold text-indigo-600 underline">
                        Watch an ad for +5
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No audio recording available for this note.</p>
            )
          )}
          {note.summary && (
            <div className="bg-white border border-gray-100 rounded-xl p-3 text-sm text-gray-700">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wide">Summary</span>
              <p className="mt-1">{note.summary}</p>
            </div>
          )}
          {note.description && (
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{note.description}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {isGated ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
              <Lock className="w-6 h-6 text-gray-400" />
              <p className="text-sm text-gray-500">Chatting with AI to develop this idea is a VIP feature.</p>
            </div>
          ) : (
            <>
              {(messages || []).map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user' ? 'self-end bg-indigo-600 text-white' : 'self-start bg-white border border-gray-100 text-gray-700'
                  }`}
                >
                  {m.content}
                </div>
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-2 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl p-3 flex items-center gap-2 flex-wrap">
            <span>{error}</span>
            {limitReached && (
              <button type="button" onClick={() => setShowAdModal(true)} className="font-bold text-indigo-600 underline">
                Watch an ad for +5
              </button>
            )}
          </div>
        )}

        {voiceGatedNotice && (
          <div className="mx-4 mb-2 bg-amber-50 border border-amber-100 text-amber-700 text-sm rounded-xl p-3 flex items-center justify-between gap-2">
            <span>Voice chat with AI is a premium feature - it's not available through ads, only a paid plan or admin grant.</span>
            <button type="button" onClick={() => setVoiceGatedNotice(false)} className="font-bold text-amber-800 shrink-0">✕</button>
          </div>
        )}

        {!isGated && (
          <div className="p-4 border-t border-gray-100 bg-white flex gap-2 sticky bottom-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isSending && handleSend()}
              placeholder={isRecordingVoice ? 'Recording... tap the mic to stop' : 'Continue the conversation...'}
              disabled={isRecordingVoice || isSendingVoice}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
            <button
              onClick={handleMicClick}
              disabled={isSendingVoice}
              title={isVoiceChatGated ? 'Voice chat is a premium feature' : 'Send a voice message'}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 ${
                isRecordingVoice ? 'bg-red-600 text-white hover:bg-red-700' : isVoiceChatGated ? 'bg-gray-100 text-gray-400' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              {isSendingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : isRecordingVoice ? <Square className="w-4 h-4" fill="currentColor" /> : isVoiceChatGated ? <Lock className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || isRecordingVoice || isSendingVoice || !input.trim()}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      <AdModal isOpen={showAdModal} onClose={() => { setShowAdModal(false); setLimitReached(false); setError(null); }} featureKey="ai_notes_assist" />
      <AdModal isOpen={showSummarizeAdModal} onClose={() => { setShowSummarizeAdModal(false); clearSummarizeError(); }} featureKey="ai_notes_assist" />
    </main>
  );
}
