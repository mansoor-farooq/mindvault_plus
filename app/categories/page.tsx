'use client';
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Category } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import CategoryNode from '@/components/categories/CategoryNode';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';

export default function CategoriesPage() {
  const [rootName, setRootName] = useState('');

  const categories = useLiveQuery(() => db.categories.filter((c) => !c.isDeleted).toArray()) || [];

  const childrenByParentId = useMemo(() => {
    const map = new Map<string | undefined, Category[]>();
    for (const cat of categories) {
      // Normalize null -> undefined: a synced-then-pulled category comes back with
      // parentId: null (from Postgres) rather than undefined (a plain JS Map treats
      // those as different keys, which would make root categories vanish after sync).
      const key = cat.parentId ?? undefined;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cat);
    }
    return map;
  }, [categories]);

  const roots = childrenByParentId.get(undefined) ?? [];

  const handleAddRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = rootName.trim();
    if (!name) return;
    await db.categories.add({
      name,
      isActive: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    setRootName('');
    SyncService.sync();
  };

  const handleAddChild = async (parentSyncId: string, name: string) => {
    await db.categories.add({
      name,
      parentId: parentSyncId,
      isActive: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    SyncService.sync();
  };

  const handleRename = async (syncId: string, newName: string) => {
    await db.categories.where('syncId').equals(syncId).modify({ name: newName, updatedAt: new Date() });
    SyncService.sync();
  };

  // Collects a category and every one of its descendants (recursively) by syncId.
  const collectSubtreeSyncIds = (rootSyncId: string): string[] => {
    const result: string[] = [rootSyncId];
    const stack = [rootSyncId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const children = childrenByParentId.get(current) ?? [];
      for (const child of children) {
        if (child.syncId) {
          result.push(child.syncId);
          stack.push(child.syncId);
        }
      }
    }
    return result;
  };

  const handleDelete = async (syncId: string) => {
    if (!confirm('Delete this category and all its subcategories? Products in it will become uncategorized (not deleted).')) return;

    const subtreeSyncIds = collectSubtreeSyncIds(syncId);
    const now = new Date();

    await db.transaction('rw', db.categories, db.products, async () => {
      for (const id of subtreeSyncIds) {
        await db.categories.where('syncId').equals(id).modify({ isDeleted: true, deletedAt: now, updatedAt: now });
      }
      // Clear only the structured FK - leave the denormalized `category` name string
      // untouched so products keep showing their old label without cascading deletion.
      await db.products.where('categoryId').anyOf(subtreeSyncIds).modify({ categoryId: undefined, updatedAt: now });
    });

    SyncService.sync();
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-20 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/inventory" className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <h1 className="text-2xl text-white font-bold">Categories</h1>
      </div>

      <form onSubmit={handleAddRoot} className="bg-slate-900 border border-white/5 p-4 rounded-xl flex gap-2">
        <input
          className="bg-white/5 border border-white/10 rounded-lg p-2 text-white flex-1"
          placeholder="New top-level category"
          value={rootName}
          onChange={(e) => setRootName(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 rounded-lg transition flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      <div className="bg-slate-900 border border-white/5 p-3 rounded-xl">
        {roots.length === 0 ? (
          <p className="text-gray-500 text-sm p-2">No categories yet. Add your first one above.</p>
        ) : (
          roots.map((root) => (
            <CategoryNode
              key={root.syncId}
              category={root}
              childrenByParentId={childrenByParentId}
              depth={0}
              onAddChild={handleAddChild}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
