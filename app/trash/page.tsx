"use client";

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { ArrowLeft, Trash2, RefreshCcw, Search } from 'lucide-react';
import Link from 'next/link';

export default function TrashPage() {
  // Fetch only deleted notes from Dexie
  const deletedNotes = useLiveQuery(
    () => db.notes.filter(note => !!note.isDeleted).reverse().sortBy('deletedAt')
  );

  const restoreNote = async (id?: number) => {
    if (id !== undefined) {
      await db.notes.update(id, { isDeleted: false, deletedAt: undefined });
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 h-screen">
      <header className="bg-indigo-900 text-white p-4 flex items-center justify-between shadow-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-indigo-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-xl font-bold tracking-wide">Trash (Recycle Bin)</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 flex items-start gap-3">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600 mt-0.5">
            <Trash2 className="w-4 h-4" />
          </div>
          <p className="text-sm text-blue-800 leading-relaxed">
            Items here are soft-deleted and will not appear in your main dashboard or searches. 
            <br/><span className="font-semibold">Note:</span> Permanent deletion is disabled by system policy to ensure you never lose your data.
          </p>
        </div>

        {deletedNotes === undefined ? (
          <div className="text-center text-gray-500 mt-10">Loading trash...</div>
        ) : deletedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-gray-400 mt-20 animate-fade-in-up">
            <div className="bg-gray-100 p-6 rounded-full mb-4">
              <Trash2 className="w-12 h-12 text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-600 mb-2">Trash is empty</p>
            <p className="text-sm">No deleted items found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deletedNotes.map(note => (
              <div key={note.id} className="bg-white p-4 rounded-xl shadow-sm border border-red-50 flex items-center justify-between gap-3 animate-fade-in-up">
                <div className="flex-1 min-w-0 opacity-70">
                  <h3 className="font-semibold text-gray-900 truncate">{note.title || 'Untitled'}</h3>
                  <p className="text-xs text-gray-500 line-clamp-1 mb-1">{note.description}</p>
                  <p className="text-xs text-red-400 font-medium">
                    Deleted on {note.deletedAt ? new Date(note.deletedAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                
                <button 
                  onClick={() => restoreNote(note.id)}
                  className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-2 rounded-lg font-medium text-sm hover:bg-indigo-100 transition-colors"
                >
                  <RefreshCcw className="w-4 h-4" /> Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
