"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, File, ArrowLeft, Save, X } from 'lucide-react';
import { db } from '@/lib/db';
import Link from 'next/link';

const CATEGORIES = ['Business', 'Study', 'Personal'];

export default function DocumentNotePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Study');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        setTitle(file.name.replace('.pdf', ''));
      } else {
        alert('Currently only PDF documents are supported.');
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setTitle('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const saveDocumentNote = async () => {
    if (!selectedFile) return;
    
    try {
      // 1. Create the Note entry
      const noteId = await db.notes.add({
        title: title || selectedFile.name,
        description,
        type: 'DOCUMENT',
        category,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        isDeleted: false,
      });
      const createdNote = await db.notes.get(noteId);

      // 2. Create the Document entry
      await db.documents.add({
        noteId: createdNote?.syncId || '',
        fileName: selectedFile.name,
        filePath: '', // For local it's stored in blob
        folder: 'Root',
        totalPages: 0, // This would be parsed later
        lastPageRead: 0,
        readStatus: 'UNREAD',
        bookmarks: [],
        timeSpentMinutes: 0,
        fileBlob: selectedFile,
      });

      router.push('/');
    } catch (error) {
      console.error('Failed to save document:', error);
      alert('Failed to save document locally.');
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 h-screen">
      <header className="bg-white p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </Link>
          <h1 className="text-xl font-bold text-gray-800">Upload Document</h1>
        </div>
        {selectedFile && (
          <button 
            onClick={saveDocumentNote}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full font-medium hover:bg-indigo-700 transition-colors"
          >
            <Save className="w-4 h-4" /> Save
          </button>
        )}
      </header>

      <div className="flex-1 p-6 flex flex-col max-w-lg mx-auto w-full gap-6">
        
        {!selectedFile ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-indigo-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50 transition-colors bg-white mt-8 shadow-sm"
          >
            <div className="bg-indigo-100 p-4 rounded-full mb-4">
              <FileUp className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Select a PDF Document</h2>
            <p className="text-gray-500 text-sm">Tap to browse your device files</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".pdf,application/pdf"
              className="hidden"
            />
          </div>
        ) : (
          <>
            {/* File Info Card */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 animate-fade-in-up mt-4">
              <div className="bg-red-50 p-3 rounded-xl">
                <File className="w-8 h-8 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • PDF</p>
              </div>
              <button onClick={removeFile} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Note Details Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 animate-fade-in-up">
              <input
                type="text"
                placeholder="Document Title"
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
                placeholder="Add notes about this document..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-32 resize-none text-gray-600 placeholder-gray-400 focus:outline-none bg-transparent mt-2 leading-relaxed"
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
