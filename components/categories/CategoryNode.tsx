'use client';
import { useState } from 'react';
import { Category } from '@/lib/db';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X } from 'lucide-react';

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
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 rounded-lg hover:bg-white/5 group"
        style={{ paddingLeft: depth * 20 }}
      >
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className={`p-0.5 text-gray-500 hover:text-gray-300 transition ${children.length === 0 ? 'invisible' : ''}`}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isEditing ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              autoFocus
              className="bg-white/10 border border-white/20 rounded-md px-2 py-1 text-sm text-white flex-1"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitRename()}
            />
            <button onClick={submitRename} className="p-1 text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setIsEditing(false); setEditValue(category.name); }} className="p-1 text-gray-400 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <>
            <span className="text-sm text-white flex-1">{category.name}</span>
            <div className="hidden group-hover:flex items-center gap-1">
              <button onClick={() => setIsAddingChild((v) => !v)} className="p-1 text-blue-400 hover:text-blue-300" title="Add subcategory">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsEditing(true)} className="p-1 text-gray-400 hover:text-gray-200" title="Rename">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(category.syncId!)} className="p-1 text-red-400 hover:text-red-300" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {isAddingChild && (
        <div className="flex items-center gap-1.5" style={{ paddingLeft: (depth + 1) * 20 + 24 }}>
          <input
            autoFocus
            className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white flex-1"
            placeholder="Subcategory name"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAddChild()}
          />
          <button onClick={submitAddChild} className="p-1 text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setIsAddingChild(false); setChildName(''); }} className="p-1 text-gray-400 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
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
