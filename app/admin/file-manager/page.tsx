"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { Folder, Upload, FileText, Image as ImageIcon, Video, Music, HardDrive, MoreVertical, Trash2, Download, Search, Grid, List } from 'lucide-react';

export default function FileManagerPage() {
  const { palette, mode } = useAdminTheme();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const FOLDERS = [
    { name: 'Design Assets', files: '148 Files', size: '12.4 GB', icon: '🎨' },
    { name: 'Work Projects', files: '82 Files', size: '28.0 GB', icon: '💼' },
    { name: 'Financial Documents', files: '35 Files', size: '2.1 GB', icon: '📊' },
    { name: 'Media Recordings', files: '19 Files', size: '14.5 GB', icon: '🎬' },
  ];

  const FILES = [
    { name: 'Minimal_UI_Kit_v5_Design.fig', type: 'Figma', size: '42.8 MB', date: 'Aug 18, 2026', icon: '🎨' },
    { name: 'Q3_Financial_Forecast_Report.pdf', type: 'PDF Document', size: '4.2 MB', date: 'Aug 17, 2026', icon: '📄' },
    { name: 'App_Promo_Video_4K.mp4', type: 'Video MP4', size: '450.0 MB', date: 'Aug 15, 2026', icon: '🎥' },
    { name: 'Database_Backup_2026.zip', type: 'Archive ZIP', size: '1.2 GB', date: 'Aug 12, 2026', icon: '📦' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Cloud File Manager</h1>
          <p className="text-xs text-gray-400">Manage assets, documentation & corporate cloud drive</p>
        </div>
        <button
          onClick={() => alert('File Upload Modal: Drag & Drop activated!')}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-105"
          style={{ background: palette.accentGradient }}
        >
          <Upload className="w-4 h-4" />
          <span>Upload File</span>
        </button>
      </div>

      {/* Storage Capacity Widget */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl" style={{ backgroundColor: palette.primaryLight, color: palette.primary }}>
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Cloud Storage Capacity</h3>
              <p className="text-xs text-gray-400">102 GB of 128 GB Used (80%)</p>
            </div>
          </div>
          <span className="text-xs font-bold text-primary">Upgrade Storage →</span>
        </div>

        {/* Storage Bar */}
        <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
          <div className="h-full bg-purple-500" style={{ width: '40%' }} title="Images 42GB" />
          <div className="h-full bg-cyan-500" style={{ width: '25%' }} title="Videos 28GB" />
          <div className="h-full bg-amber-500" style={{ width: '10%' }} title="Documents 14GB" />
          <div className="h-full bg-emerald-500" style={{ width: '5%' }} title="Audio 8GB" />
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-semibold pt-1">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Images (42 GB)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Videos (28 GB)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Documents (14 GB)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Audio (8 GB)</span>
        </div>
      </div>

      {/* Folders Section */}
      <div className="space-y-4">
        <h3 className="font-bold text-lg">Folders</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FOLDERS.map((folder) => (
            <div
              key={folder.name}
              className={`p-5 rounded-2xl border shadow-sm space-y-3 transition-all hover:shadow-md cursor-pointer ${
                mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{folder.icon}</span>
                <button className="text-gray-400 hover:text-gray-200">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <div>
                <h4 className="font-bold text-xs line-clamp-1">{folder.name}</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">{folder.files} • {folder.size}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Files Grid */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Recent Files</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-gray-400'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 ${viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FILES.map((file) => (
              <div
                key={file.name}
                className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800/80 bg-gray-50/40 dark:bg-gray-900/40 space-y-3 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl shadow-sm">
                  {file.icon}
                </div>
                <div>
                  <h4 className="text-xs font-bold truncate">{file.name}</h4>
                  <p className="text-[10px] text-gray-400">{file.size} • {file.date}</p>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs">
                  <span className="text-[10px] font-semibold text-gray-400">{file.type}</span>
                  <button className="text-primary hover:underline font-bold text-[11px] flex items-center gap-1">
                    <Download className="w-3 h-3" /> Get
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-3">File Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                {FILES.map((file) => (
                  <tr key={file.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="py-3 px-3 font-bold flex items-center gap-2">
                      <span>{file.icon}</span>
                      <span>{file.name}</span>
                    </td>
                    <td className="py-3 px-3 text-gray-400">{file.type}</td>
                    <td className="py-3 px-3 font-bold">{file.size}</td>
                    <td className="py-3 px-3 text-gray-400">{file.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
