"use client";

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note } from '@/lib/db';
import { Plus, Search, Settings, Mic, FileText, FileUp, Star, Wallet, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';

const CATEGORIES = ['All', 'Business', 'Meeting', 'Study', 'Personal', 'Event'];

export default function Home() {
  const { user } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isFabOpen, setIsFabOpen] = useState(false);
  
  // Search State
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch notes from Dexie based on filters
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

  // Filter notes by search query locally since Dexie doesn't have native full-text search without extensions
  const filteredNotes = useMemo(() => {
    if (!notes) return undefined;
    if (!searchQuery.trim()) return notes;
    
    const query = searchQuery.toLowerCase();
    return notes.filter(note => 
      note.title?.toLowerCase().includes(query) || 
      note.description?.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  // Group notes into Today, Yesterday, Earlier
  const groupedNotes = useMemo(() => {
    if (!filteredNotes) return null;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { [key: string]: Note[] } = {
      'Today': [],
      'Yesterday': [],
      'Earlier': []
    };

    filteredNotes.forEach(note => {
      const noteDate = new Date(note.createdAt);
      if (noteDate.toDateString() === today.toDateString()) {
        groups['Today'].push(note);
      } else if (noteDate.toDateString() === yesterday.toDateString()) {
        groups['Yesterday'].push(note);
      } else {
        groups['Earlier'].push(note);
      }
    });

    return groups;
  }, [filteredNotes]);

  return (
    <main className="flex-1 flex flex-col bg-gray-50 h-screen relative">
      {/* Top Bar */}
      <header className="bg-indigo-900 text-white p-4 shadow-md z-10 sticky top-0 min-h-[68px] flex flex-col justify-center transition-all duration-300">
        {!isSearchActive ? (
          <div className="flex justify-between items-center w-full animate-fade-in-up">
            <h1 className="text-xl font-bold tracking-wide">MindVault</h1>
            <div className="flex gap-4 items-center">
              <Link href="/finance" className="hover:text-indigo-200 transition-colors">
                <Wallet className="w-6 h-6" />
              </Link>
              <button onClick={() => setIsSearchActive(true)} className="hover:text-indigo-200 transition-colors">
                <Search className="w-6 h-6" />
              </button>
              <button className="hover:text-indigo-200 transition-colors">
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 w-full animate-fade-in-up bg-white rounded-full px-4 py-2 text-gray-800">
            <Search className="w-5 h-5 text-gray-400" />
            <input 
              autoFocus
              type="text" 
              placeholder="Search notes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-sm font-medium placeholder-gray-400"
            />
            <button onClick={() => {
              setIsSearchActive(false);
              setSearchQuery('');
            }}>
              <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        )}
      </header>

      {/* Category Chips */}
      <div className="overflow-x-auto whitespace-nowrap p-4 no-scrollbar bg-white shadow-sm border-b border-gray-100">
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

      {/* Notes List with Timeline Grouping */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {groupedNotes === null ? (
          <div className="text-center text-gray-500 mt-10">Loading...</div>
        ) : filteredNotes && filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 mt-20 animate-fade-in-up">
            <div className="bg-indigo-50 p-6 rounded-full mb-4">
              <Search className="w-12 h-12 text-indigo-300" />
            </div>
            <p className="text-lg font-medium text-gray-600 mb-2">
              {searchQuery ? "No results found" : "Your mind is empty right now"}
            </p>
            <p className="text-sm">
              {searchQuery ? `Try a different search term` : `add your first thought!`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNotes).map(([groupName, groupNotes]) => {
              if (groupNotes.length === 0) return null;
              
              return (
                <div key={groupName} className="animate-fade-in-up">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-2">
                    {groupName}
                  </h2>
                  <div className="space-y-4">
                    {groupNotes.map(note => (
                      <div key={note.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-3 hover:shadow-md transition-shadow cursor-pointer">
                        {note.type === 'VOICE' && (
                          <div className="p-3 bg-red-50 text-red-500 rounded-xl h-fit">
                            <Mic className="w-6 h-6" />
                          </div>
                        )}
                        {note.type === 'DOCUMENT' && (
                          <div className="p-3 bg-blue-50 text-blue-500 rounded-xl h-fit">
                            <FileUp className="w-6 h-6" />
                          </div>
                        )}
                        {note.type === 'TEXT' && (
                          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl h-fit">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-semibold text-gray-900 truncate pr-2">{note.title || 'Untitled'}</h3>
                            {note.isFavorite && <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />}
                          </div>
                          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{note.description}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium truncate max-w-[100px]">
                              {note.category}
                            </span>
                            <span>•</span>
                            <span>
                              {note.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50">
        {isFabOpen && (
          <div className="flex flex-col gap-3 mb-2 items-end animate-fade-in-up">
            <Link href="/notes/document" className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Upload Document <FileUp className="w-4 h-4 text-blue-600" />
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
          className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
          onClick={() => setIsFabOpen(false)}
        />
      )}
    </main>
  );
}
