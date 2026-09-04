'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import { ArrowLeft, Mic, Square, Loader2, Check, Sparkles, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function VoiceNotePage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [transcriptionData, setTranscriptionData] = useState<{
    title: string;
    transcript: string;
    summary: string;
    tags: string[];
    actionItems?: string[];
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = handleProcessAudio;
      mediaRecorderRef.current.stop();
      
      // Stop all microphone tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleProcessAudio = async () => {
    if (audioChunksRef.current.length === 0) return;
    
    setIsTranscribing(true);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    
    try {
      const base64Audio = await blobToBase64(audioBlob);

      const response = await fetch('/api/ai/notes/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType: 'audio/webm',
          locale: navigator.language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to transcribe audio');
      }

      setTranscriptionData(data);
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during transcription');
    } finally {
      setIsTranscribing(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result?.toString().split(',')[1];
        if (base64String) resolve(base64String);
        else reject(new Error('Failed to convert blob to base64'));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSaveNote = async () => {
    if (!transcriptionData || !user) return;

    try {
      await db.notes.add({
        syncId: crypto.randomUUID(),
        title: transcriptionData.title,
        description: transcriptionData.transcript + (transcriptionData.actionItems?.length ? '\n\nAction Items:\n- ' + transcriptionData.actionItems.join('\n- ') : ''),
        summary: transcriptionData.summary,
        category: 'Personal',
        tags: transcriptionData.tags,
        isFavorite: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      SyncService.sync();
      router.push('/');
    } catch (err) {
      setError('Failed to save note.');
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 flex items-center justify-between shadow-lg shadow-indigo-200/50 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
            <Mic className="w-5 h-5" /> Voice Note
          </h1>
        </div>
      </div>

      <div className="flex-1 p-4 max-w-2xl w-full mx-auto flex flex-col gap-6">
        
        {/* Error Message */}
        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Recording Interface */}
        {!transcriptionData && !isTranscribing && (
          <div className="flex flex-col items-center justify-center py-12 gap-8">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording ? 'bg-rose-100 animate-pulse text-rose-600 ring-8 ring-rose-50' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <Mic className={`w-12 h-12 ${isRecording ? 'animate-bounce' : ''}`} />
            </div>
            
            <div className="text-center">
              <h2 className="text-3xl font-mono font-light text-gray-700">
                {formatTime(recordingTime)}
              </h2>
              <p className="text-gray-400 mt-2 text-sm">
                {isRecording ? 'Listening...' : 'Tap to start recording'}
              </p>
            </div>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`px-8 py-4 rounded-full font-bold text-white flex items-center gap-2 transition-transform active:scale-95 shadow-lg ${
                isRecording ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {isRecording ? (
                <><Square className="w-5 h-5 fill-current" /> Stop & Process</>
              ) : (
                <><Mic className="w-5 h-5" /> Start Recording</>
              )}
            </button>
          </div>
        )}

        {/* Loading State */}
        {isTranscribing && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-indigo-600">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="font-medium animate-pulse">Gemini AI is transcribing and summarizing...</p>
          </div>
        )}

        {/* Result Interface */}
        {transcriptionData && !isTranscribing && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b border-gray-100 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{transcriptionData.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{transcriptionData.summary}</p>
                </div>
                <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0 mt-1" />
              </div>
              
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Full Transcript</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">{transcriptionData.transcript}</p>
                </div>

                {transcriptionData.actionItems && transcriptionData.actionItems.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Action Items</h4>
                    <ul className="space-y-2">
                      {transcriptionData.actionItems.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {transcriptionData.tags && transcriptionData.tags.length > 0 && (
                  <div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {transcriptionData.tags.map(tag => (
                        <span key={tag} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setTranscriptionData(null)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Discard & Retry
              </button>
              <button
                onClick={handleSaveNote}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                Save Note
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
