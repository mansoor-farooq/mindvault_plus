'use client';

import { useState, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { blobToBase64 } from '@/hooks/useNoteAssist';
import AdModal from '@/components/AdModal';
import Link from 'next/link';
import { ArrowLeft, Mic, Square, Loader2, Mail, Copy, Check, Lock } from 'lucide-react';

export default function VoiceEmailPage() {
  const { token, featureAccess } = useAuthStore();
  const isGated = featureAccess ? featureAccess['voice_email'] === false : false;

  const [isRecording, setIsRecording] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    setError(null);
    setLimitReached(false);
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
        setIsRecording(false);
        handleDraft(blob);
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      setError('Microphone access is required to record a voice message.');
    }
  };

  const handleDraft = async (blob: Blob) => {
    if (!token || blob.size === 0) return;
    setIsDrafting(true);
    setSubject('');
    setBody('');
    try {
      const base64 = await blobToBase64(blob);
      const res = await fetch('/api/ai/voice-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audio: { mimeType: blob.type || 'audio/webm', base64 } }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'AI_LIMIT_REACHED') {
          setLimitReached(true);
          throw new Error("You've hit today's free limit for this feature.");
        }
        throw new Error(data.message || data.error || 'Failed to draft the email');
      }
      setSubject(data.subject);
      setBody(data.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 flex items-center gap-3 shadow-lg shadow-indigo-200/50 sticky top-0 z-10">
        <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-white" />
        </Link>
        <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
          <Mail className="w-5 h-5" /> Voice to Email
        </h1>
      </header>

      <div className="flex-1 p-4 max-w-2xl w-full mx-auto flex flex-col gap-4">
        {isGated ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center gap-2 text-center mt-8">
            <Lock className="w-6 h-6 text-gray-400" />
            <p className="text-sm text-gray-500">Voice to Email is a premium feature - not available through ads, only a paid plan or admin grant.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">Record what you want to say - AI writes it up as a ready-to-send email.</p>

            <div className="flex flex-col items-center gap-3 py-6">
              <button
                onClick={handleMicClick}
                disabled={isDrafting}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-50 ${
                  isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isDrafting ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : isRecording ? (
                  <Square className="w-7 h-7 text-white" fill="currentColor" />
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
              </button>
              <p className="text-xs text-gray-400">
                {isDrafting ? 'Drafting your email...' : isRecording ? 'Recording... tap to stop' : 'Tap to record'}
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl p-3 flex items-center gap-2 flex-wrap">
                <span>{error}</span>
                {limitReached && (
                  <button type="button" onClick={() => setShowAdModal(true)} className="font-bold text-indigo-600 underline">
                    Watch an ad for +5
                  </button>
                )}
              </div>
            )}

            {(subject || body) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="font-bold text-lg border-b border-gray-100 pb-2 focus:outline-none"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="text-gray-700 leading-relaxed resize-none focus:outline-none"
                />
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <a
                    href={mailtoHref}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                  >
                    <Mail className="w-4 h-4" /> Open in Email App
                  </a>
                  <button
                    onClick={handleCopy}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AdModal isOpen={showAdModal} onClose={() => { setShowAdModal(false); setLimitReached(false); setError(null); }} featureKey="ai_voice_transcribe" />
    </main>
  );
}
