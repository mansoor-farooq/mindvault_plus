"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = ['Business', 'Meeting', 'Study', 'Personal', 'Event'];

export default function TextNote() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title && !description) return;
    
    setIsSaving(true);
    try {
      await db.notes.add({
        title,
        description,
        type: 'TEXT',
        category,
        tags: [],
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
      <header className="bg-white p-4 flex justify-between items-center shadow-sm border-b">
        <Link href="/" className="p-2 -ml-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="font-semibold text-lg">New Note</h1>
        <button 
          onClick={handleSave} 
          disabled={isSaving || (!title && !description)}
          className="flex items-center gap-1 text-indigo-600 font-medium disabled:opacity-50"
        >
          <Save className="w-5 h-5" /> Save
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <input
          type="text"
          placeholder="Note Title"
          className="w-full text-2xl font-bold bg-transparent border-none outline-none placeholder:text-gray-400"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        
        <select 
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-max bg-indigo-50 text-indigo-700 border-none rounded-md py-1.5 px-3 text-sm font-medium outline-none"
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <textarea
          placeholder="Start typing your thoughts..."
          className="flex-1 w-full bg-transparent border-none outline-none resize-none placeholder:text-gray-400 text-gray-700 text-lg leading-relaxed mt-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </main>
    </div>
  );
}
