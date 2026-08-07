"use client";

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note } from '@/lib/db';
import { Plus, Search, Settings, Mic, FileText, FileUp, Star, Wallet, X, Trash2, Cloud, Loader2, User as UserIcon, LogOut, Lock, LayoutGrid, List, Store } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { SyncService } from '@/services/SyncService';
import BannedScreen from '@/components/BannedScreen';
import { useRouter } from 'next/navigation';

const CATEGORIES = ['All', 'Business', 'Meeting', 'Study', 'Personal', 'Event'];

export default function Home() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const handleLogout = () => {
    logout();
    router.push('/login');
  };
  
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const ledgerEntries = useLiveQuery(() => db.ledgerEntries.toArray());
  
  const stats = useMemo(() => {
    if (!ledgerEntries) return { balance: 0, expenses: 0 };
    let balance = 0;
    let expenses = 0;
    ledgerEntries.forEach(e => {
      if (e.type === 'INCOME') balance += Number(e.amount);
      if (e.type === 'EXPENSE') {
        balance -= Number(e.amount);
        expenses += Number(e.amount);
      }
    });
    return { balance, expenses };
  }, [ledgerEntries]);

  const filteredNotes = useMemo(() => {
    if (!notes) return undefined;
    if (!searchQuery.trim()) return notes;
    
    const query = searchQuery.toLowerCase();
    return notes.filter(note => 
      note.title?.toLowerCase().includes(query) || 
      note.description?.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  const { pinnedNotes, groupedNotes } = useMemo(() => {
    if (!filteredNotes) return { pinnedNotes: [], groupedNotes: null };

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const pinned: Note[] = [];
    const groups: { [key: string]: Note[] } = {
      'Today': [],
      'Yesterday': [],
      'Earlier': []
    };

    filteredNotes.forEach(note => {
      if (note.isFavorite) {
        pinned.push(note);
        return; // Skip grouped if pinned
      }

      const noteDate = new Date(note.createdAt);
      if (noteDate.toDateString() === today.toDateString()) {
        groups['Today'].push(note);
      } else if (noteDate.toDateString() === yesterday.toDateString()) {
        groups['Yesterday'].push(note);
      } else {
        groups['Earlier'].push(note);
      }
    });

    return { pinnedNotes: pinned, groupedNotes: groups };
  }, [filteredNotes]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await SyncService.sync();
    } catch(e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === highlight.toLowerCase() 
        ? <span key={index} className="bg-yellow-200 text-yellow-900 rounded-sm px-1 font-bold">{part}</span> 
        : part
    );
  };

  if (user?.status === 'BANNED') {
    return <BannedScreen />;
  }

  const NoteCard = ({ note }: { note: Note }) => (
    <div 
      className={`bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-gray-100/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex gap-4 ${viewMode === 'grid' ? 'flex-col' : 'items-start'}`}
      style={{ boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}
    >
      <div className={`p-3 rounded-2xl h-fit ${
        note.type === 'VOICE' ? 'bg-red-50 text-red-500' :
        note.type === 'DOCUMENT' ? 'bg-blue-50 text-blue-500' :
        'bg-amber-50 text-amber-500'
      }`}>
        {note.type === 'VOICE' && <Mic className="w-6 h-6" />}
        {note.type === 'DOCUMENT' && <FileUp className="w-6 h-6" />}
        {note.type === 'TEXT' && <FileText className="w-6 h-6" />}
      </div>

      <div className="flex-1 min-w-0 w-full">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-900 truncate pr-2 text-lg">
            {highlightText(note.title || 'Untitled', searchQuery)}
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                if(note.id) {
                  await db.notes.update(note.id, { isFavorite: !note.isFavorite, updatedAt: new Date() });
                }
              }}
              className="transition-colors hover:scale-110 active:scale-95"
            >
              <Star className={`w-5 h-5 ${note.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-gray-300 hover:text-amber-400'}`} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if(note.id) {
                  db.notes.update(note.id, { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() });
                }
              }}
              className="text-gray-300 hover:text-red-500 transition-colors hover:scale-110 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500 line-clamp-3 mb-4 leading-relaxed">
          {highlightText(note.description, searchQuery)}
        </p>
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="bg-indigo-50/80 text-indigo-700 px-3 py-1 rounded-full truncate max-w-[120px] border border-indigo-100/50">
            {note.category}
          </span>
          <span className="text-gray-400">
            {note.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <main className="flex-1 flex flex-col bg-[#F8FAFC] h-screen relative overflow-hidden">
      {/* Premium Glassmorphism Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-gray-200/50 shadow-sm transition-all duration-300">
        <div className="p-4">
          {!isSearchActive ? (
            <div className="flex justify-between items-center w-full animate-fade-in-up">
              <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight">
                MindVault
              </h1>
              <div className="flex gap-4 items-center text-gray-600">
                <button onClick={() => setIsSearchActive(true)} className="hover:text-indigo-600 transition-colors">
                  <Search className="w-6 h-6" />
                </button>
                
                {/* User Profile Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)} 
                    className="flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-full w-9 h-9 shadow-md hover:shadow-lg transition-all hover:scale-105"
                  >
                    <UserIcon className="w-5 h-5" />
                  </button>
                  
                  {isProfileOpen && (
                    <div className="absolute right-0 mt-3 w-64 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-gray-800 z-50 animate-fade-in-up">
                      <div className="p-5 border-b border-gray-100 bg-gradient-to-b from-indigo-50/50 to-transparent">
                        <p className="font-bold text-base truncate">{user?.fullName || 'User'}</p>
                        <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                        <div className="mt-3 inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full tracking-wide">
                          {user?.license || 'FREE'} PLAN
                        </div>
                      </div>
                      <div className="p-2">
                        <button 
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-3 text-sm text-red-600 font-medium hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors"
                        >
                          <LogOut className="w-5 h-5" />
                          Log out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full animate-fade-in-up bg-gray-100/80 backdrop-blur-md rounded-2xl px-5 py-3 text-gray-800 border border-gray-200/50 shadow-inner">
              <Search className="w-5 h-5 text-indigo-500" />
              <input 
                autoFocus
                type="text" 
                placeholder="Search your mind..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-base font-medium placeholder-gray-400"
              />
              <button onClick={() => {
                setIsSearchActive(false);
                setSearchQuery('');
              }}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors hover:scale-110" />
              </button>
            </div>
          )}
        </div>

        {/* Stats Widget */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 p-4 rounded-2xl shadow-lg text-white">
            <div className="flex flex-col">
              <span className="text-indigo-100 text-xs font-medium tracking-wider uppercase mb-1">Total Balance</span>
              <span className="text-2xl font-bold">Rs {stats.balance.toLocaleString()}</span>
            </div>
            <div className="w-px h-10 bg-white/20 mx-4"></div>
            <div className="flex flex-col">
              <span className="text-indigo-100 text-xs font-medium tracking-wider uppercase mb-1">Total Notes</span>
              <span className="text-2xl font-bold">{notes?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Quick Tools Grid */}
        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/finance" className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100/50 flex flex-col items-center justify-center gap-3 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="bg-blue-50 text-blue-500 p-3 rounded-full">
              <Wallet className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-700 text-sm">Finance & Bills</span>
          </Link>
          <Link href="/khata" className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100/50 flex flex-col items-center justify-center gap-3 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="bg-emerald-50 text-emerald-500 p-3 rounded-full">
              <Store className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-700 text-sm">Dukaan Khata</span>
          </Link>
          <Link href="/trash" className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100/50 flex flex-col items-center justify-center gap-3 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="bg-red-50 text-red-500 p-3 rounded-full">
              <Trash2 className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-700 text-sm">Recycle Bin</span>
          </Link>
          <button onClick={handleSync} disabled={isSyncing} className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100/50 flex flex-col items-center justify-center gap-3 hover:shadow-lg hover:-translate-y-1 transition-all disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-sm">
            <div className="bg-indigo-50 text-indigo-500 p-3 rounded-full">
              {isSyncing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Cloud className="w-6 h-6" />}
            </div>
            <span className="font-bold text-gray-700 text-sm">Cloud Sync</span>
          </button>
        </div>

        {/* Category Chips & View Toggle */}
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="overflow-x-auto whitespace-nowrap no-scrollbar flex-1 mr-4">
            <div className="flex gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    selectedCategory === cat 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200/60 shadow-sm'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          
          {/* Grid / List Toggle */}
          <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200/60">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Notes List with Timeline Grouping */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {groupedNotes === null ? (
          <div className="flex justify-center mt-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : filteredNotes && filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center mt-20 animate-fade-in-up">
            <div className="bg-white p-6 rounded-full shadow-lg shadow-indigo-100/50 mb-6 border border-gray-100">
              <Search className="w-12 h-12 text-indigo-300" />
            </div>
            <p className="text-xl font-bold text-gray-800 mb-2">
              {searchQuery ? "No results found" : "Your mind is clear"}
            </p>
            <p className="text-sm text-gray-500 font-medium">
              {searchQuery ? `Try a different search term` : `Tap the + button to capture a thought`}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Pinned Notes Section */}
            {pinnedNotes.length > 0 && (
              <div className="animate-fade-in-up">
                <div className="flex items-center gap-2 mb-4 ml-1">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <h2 className="text-sm font-bold text-gray-800 tracking-wide">
                    PINNED
                  </h2>
                </div>
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
                  {pinnedNotes.map(note => (
                    <NoteCard key={note.id} note={note} />
                  ))}
                </div>
              </div>
            )}

            {Object.entries(groupedNotes).map(([groupName, groupNotes]) => {
              if (groupNotes.length === 0) return null;
              
              return (
                <div key={groupName} className="animate-fade-in-up">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 ml-2">
                    {groupName}
                  </h2>
                  <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
                    {groupNotes.map(note => (
                      <NoteCard key={note.id} note={note} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-6 flex flex-col items-end gap-4 z-50">
        {isFabOpen && (
          <div className="flex flex-col gap-3 mb-2 items-end animate-fade-in-up">
            <Link href="/notes/document" className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl border border-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:scale-105 transition-all">
              Upload Document <FileUp className="w-5 h-5 text-blue-600" />
            </Link>
            {user?.license === 'PRO' || user?.license === 'LIFETIME' ? (
              <Link href="/notes/voice" className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl border border-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:scale-105 transition-all">
                Voice Note <Mic className="w-5 h-5 text-red-500" />
              </Link>
            ) : (
              <button 
                onClick={() => alert('Voice Notes are a PRO feature. Upgrade your license!')}
                className="flex items-center gap-3 bg-gray-50/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl border border-gray-200 text-sm font-semibold text-gray-400 cursor-not-allowed"
              >
                Voice Note (PRO) <Lock className="w-5 h-5 text-gray-400" />
              </button>
            )}
            <Link href="/notes/text" className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl border border-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:scale-105 transition-all">
              Text Note <FileText className="w-5 h-5 text-amber-500" />
            </Link>
          </div>
        )}
        
        <button 
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`bg-gradient-to-tr from-indigo-600 to-violet-600 text-white p-5 rounded-2xl shadow-2xl hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all duration-300 ${isFabOpen ? 'rotate-45' : ''}`}
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Overlay for FAB */}
      {isFabOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/10 z-40 backdrop-blur-sm transition-all duration-300"
          onClick={() => setIsFabOpen(false)}
        />
      )}
    </main>
  );
}
