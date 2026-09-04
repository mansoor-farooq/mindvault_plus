'use client';
import { useState } from 'react';
import { Category } from '@/lib/db';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X, Folder, FolderOpen } from 'lucide-react';

interface CategoryNodeProps {
  category: Category;
  childrenByParentId: Map<string | undefined, Category[]>;
  depth: number;
  onAddChild: (parentSyncId: string, name: string) => Promise<void>;
  onRename: (syncId: string, newName: string) => Promise<void>;
  onDelete: (syncId: string) => Promise<void>;
}

export default function CategoryNode({ category, childrenByParentId, depth, onAddChild, onRename, onDelete }: CategoryNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(category.name);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [childName, setChildName] = useState('');

  const children = childrenByParentId.get(category.syncId) ?? [];

  const submitRename = async () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== category.name) {
      await onRename(category.syncId!, trimmed);
    }
    setIsEditing(false);
  };

  const submitAddChild = async () => {
    const trimmed = childName.trim();
    if (trimmed) {
      await onAddChild(category.syncId!, trimmed);
      setChildName('');
      setIsAddingChild(false);
      setIsExpanded(true);
    }
  };

  return (
    <div className="relative">
      {/* Visual branch guide line for nested nodes */}
      {depth > 0 && (
        <div 
          className="absolute left-0 top-0 bottom-0 border-l-2 border-slate-200 pointer-events-none"
          style={{ left: `${(depth - 1) * 24 + 16}px` }}
        />
      )}

      <div
        className="flex items-center gap-2 py-2 px-3 rounded-2xl hover:bg-slate-50/90 group border border-transparent hover:border-slate-200/80 transition-all my-1"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className={`p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition ${
            children.length === 0 ? 'invisible pointer-events-none' : ''
          }`}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className={`p-1.5 rounded-lg ${children.length > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
          {isExpanded && children.length > 0 ? (
            <FolderOpen className="w-4 h-4" />
          ) : (
            <Folder className="w-4 h-4" />
          )}
        </div>

        {isEditing ? (
          <div className="flex items-center gap-1.5 flex-1">
            <input
              autoFocus
              className="bg-white border-2 border-indigo-500 rounded-xl px-3 py-1 text-sm text-slate-900 font-semibold shadow-sm focus:outline-none"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditValue(category.name);
                }
              }}
            />
            <button 
              type="button"
              onClick={submitRename} 
              className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition"
              title="Save changes"
            >
              <Check className="w-4 h-4" />
            </button>
            <button 
              type="button"
              onClick={() => { setIsEditing(false); setEditValue(category.name); }} 
              className="p-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg transition"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-800 truncate">{category.name}</span>
              {children.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                  {children.length} {children.length === 1 ? 'sub-category' : 'sub-categories'}
                </span>
              )}
            </div>

            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 transition-opacity">
              <button 
                type="button"
                onClick={() => setIsAddingChild((v) => !v)} 
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition text-xs font-semibold flex items-center gap-1" 
                title="Add subcategory"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Sub</span>
              </button>
              <button 
                type="button"
                onClick={() => setIsEditing(true)} 
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition" 
                title="Rename category"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button"
                onClick={() => onDelete(category.syncId!)} 
                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" 
                title="Delete category"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {isAddingChild && (
        <div 
          className="flex items-center gap-2 py-2 px-3 my-1 bg-indigo-50/60 border border-indigo-100 rounded-2xl animate-in fade-in duration-200" 
          style={{ marginLeft: `${(depth + 1) * 24 + 12}px` }}
        >
          <Folder className="w-4 h-4 text-indigo-500 shrink-0" />
          <input
            autoFocus
            className="bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 flex-1 focus:outline-none focus:border-indigo-500 shadow-sm"
            placeholder="Subcategory name (e.g. Organic Produce)..."
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitAddChild();
              if (e.key === 'Escape') {
                setIsAddingChild(false);
                setChildName('');
              }
            }}
          />
          <button 
            type="button"
            onClick={submitAddChild} 
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" /> Add
          </button>
          <button 
            type="button"
            onClick={() => { setIsAddingChild(false); setChildName(''); }} 
            className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isExpanded &&
        children.map((child) => (
          <CategoryNode
            key={child.syncId}
            category={child}
            childrenByParentId={childrenByParentId}
            depth={depth + 1}
            onAddChild={onAddChild}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}
