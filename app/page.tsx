"use client";

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Plus, Search, Settings, Mic, FileText, FileUp, Star, MoreVertical, Wallet } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';

const CATEGORIES = ['All', 'Business', 'Meeting', 'Study', 'Personal', 'Event'];

export default function Home() {
  const { user } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Fetch notes from Dexie
  const notes = useLiveQuery(
    () => {
      let query = db.notes.filter(note => !note.isDeleted);
      if (selectedCategory !== 'All') {
        query = query.filter(note => note.category === selectedCategory);
      }
      return query.reverse().sortBy('createdAt');
    },
    [selectedCategory]
  );

  return (
    <main className="flex-1 flex flex-col bg-gray-50 h-screen relative">
      {/* Top Bar */}
      <header className="bg-indigo-900 text-white p-4 flex justify-between items-center shadow-md z-10 sticky top-0">
        <h1 className="text-xl font-bold tracking-wide">MindVault</h1>
        <div className="flex gap-4">
          <Link href="/finance"><Wallet className="w-6 h-6" /></Link>
          <button><Search className="w-6 h-6" /></button>
          <button><Settings className="w-6 h-6" /></button>
        </div>
      </header>

      {/* Category Chips */}
      <div className="overflow-x-auto whitespace-nowrap p-4 no-scrollbar bg-white shadow-sm">
        <div className="flex gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {notes === undefined ? (
          <div className="text-center text-gray-500 mt-10">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 mt-20">
            <div className="bg-indigo-50 p-6 rounded-full mb-4">
              <FileText className="w-12 h-12 text-indigo-300" />
            </div>
            <p className="text-lg font-medium text-gray-600 mb-2">Your mind is empty right now</p>
            <p className="text-sm">add your first thought!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map(note => (
              <div key={note.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-3">
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900 truncate pr-2">{note.title || 'Untitled'}</h3>
                    {note.isFavorite && <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{note.description}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium">
                      {note.category}
                    </span>
                    <span>•</span>
                    <span>{note.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50">
        {isFabOpen && (
          <div className="flex flex-col gap-3 mb-2 animate-fade-in-up items-end">
            <Link href="/notes/document" className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Upload Document <FileUp className="w-4 h-4 text-indigo-600" />
            </Link>
            <Link href="/notes/voice" className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Voice Note <Mic className="w-4 h-4 text-red-500" />
            </Link>
            <Link href="/notes/text" className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Text Note <FileText className="w-4 h-4 text-amber-500" />
            </Link>
          </div>
        )}
        
        <button 
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 transition-transform duration-200 ${isFabOpen ? 'rotate-45' : ''}`}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Overlay for FAB */}
      {isFabOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsFabOpen(false)}
        />
      )}
    </main>
  );
}
