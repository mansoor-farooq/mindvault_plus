"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Square, Play, Pause, Save, ArrowLeft, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import Link from 'next/link';

const CATEGORIES = ['Business', 'Meeting', 'Study', 'Personal', 'Event'];

export default function VoiceNotePage() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const discardRecording = () => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const saveVoiceNote = async () => {
    if (!audioBlob) return;
    
    try {
      await db.notes.add({
        title: title || 'Untitled Voice Note',
        description,
        type: 'VOICE',
        category,
        tags: [],
        audioBlob,
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        isDeleted: false,
      });
      router.push('/');
    } catch (error) {
      console.error('Failed to save voice note:', error);
      alert('Failed to save voice note locally.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 h-screen">
      <header className="bg-white p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </Link>
          <h1 className="text-xl font-bold text-gray-800">New Voice Note</h1>
        </div>
        {audioBlob && (
          <button 
            onClick={saveVoiceNote}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full font-medium hover:bg-indigo-700 transition-colors"
          >
            <Save className="w-4 h-4" /> Save
          </button>
        )}
      </header>

      <div className="flex-1 p-6 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
        
        {!audioBlob ? (
          <div className="flex flex-col items-center gap-8 w-full">
            <div className="text-center">
              <h2 className="text-4xl font-light text-gray-800 mb-2">{formatTime(recordingTime)}</h2>
              <p className="text-gray-400">{isRecording ? 'Recording in progress...' : 'Tap the microphone to start'}</p>
            </div>

            <div className="relative flex items-center justify-center h-48 w-48">
              {isRecording && (
                <>
                  <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-75"></div>
                  <div className="absolute inset-4 bg-red-200 rounded-full animate-pulse opacity-75"></div>
                </>
              )}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
                  isRecording ? 'bg-white border-4 border-red-500' : 'bg-red-500 hover:bg-red-600 hover:scale-105'
                }`}
              >
                {isRecording ? (
                  <Square className="w-8 h-8 text-red-500" fill="currentColor" />
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-6">
            {/* Audio Preview Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Recorded Audio</span>
                <span className="text-sm font-bold text-gray-800">{formatTime(recordingTime)}</span>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={togglePlayback}
                  className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center hover:bg-indigo-200 transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-1" fill="currentColor" />}
                </button>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full bg-indigo-500 ${isPlaying ? 'w-full transition-all duration-[10000ms] ease-linear' : 'w-0'}`}></div>
                </div>
                <button 
                  onClick={discardRecording}
                  className="p-3 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Discard"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              {audioUrl && (
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  onEnded={() => setIsPlaying(false)}
                  className="hidden" 
                />
              )}
            </div>

            {/* Note Details Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 animate-fade-in-up">
              <input
                type="text"
                placeholder="Voice Note Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-2xl font-bold text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent"
              />
              
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                      category === cat 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <textarea
                placeholder="Add a text description or transcript..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-32 resize-none text-gray-600 placeholder-gray-400 focus:outline-none bg-transparent mt-2 leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
