'use client';
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Category } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import CategoryNode from '@/components/categories/CategoryNode';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { ArrowLeft, Plus, FolderTree, Layers, Boxes, Sparkles, FolderPlus } from 'lucide-react';

export default function CategoriesPage() {
  const { user } = useAuthStore();
  const [rootName, setRootName] = useState('');

  const categories = useLiveQuery(() => db.categories.filter((c) => !c.isDeleted).toArray()) || [];
  const products = useLiveQuery(() => db.products.filter((p) => !p.isDeleted).toArray()) || [];

  const childrenByParentId = useMemo(() => {
    const map = new Map<string | undefined, Category[]>();
    for (const cat of categories) {
      const key = cat.parentId ?? undefined;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cat);
    }
    return map;
  }, [categories]);

  const roots = childrenByParentId.get(undefined) ?? [];
  const categorizedProductsCount = products.filter((p) => p.categoryId).length;

  const handleAddRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = rootName.trim();
    if (!name) return;
    await db.categories.add({
      syncId: crypto.randomUUID(),
      name,
      isActive: true,
      isDeleted: false,
      companyCode: user?.companyCode,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    setRootName('');
    SyncService.sync();
  };

  const handleAddChild = async (parentSyncId: string, name: string) => {
    await db.categories.add({
      syncId: crypto.randomUUID(),
      name,
      parentId: parentSyncId,
      isActive: true,
      isDeleted: false,
      companyCode: user?.companyCode,
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
      // Clear only the structured FK - leave the denormalized category name string
      // untouched so products keep showing their old label without cascading deletion.
      await db.products.where('categoryId').anyOf(subtreeSyncIds).modify({ categoryId: undefined, updatedAt: now });
    });

    SyncService.sync();
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-8 pb-24 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Link 
            href="/inventory" 
            className="p-2.5 bg-white rounded-2xl border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-sm"
            title="Back to Inventory"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-0.5">
              <span>Workspace</span>
              <span>/</span>
              <Link href="/inventory" className="hover:text-indigo-600 transition-colors">Inventory</Link>
              <span>/</span>
              <span className="text-indigo-600 font-bold">Categories</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="p-2 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                <FolderTree className="w-6 h-6" />
              </span>
              Category Classification
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link 
            href="/inventory" 
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition"
          >
            Stock Catalog
          </Link>
          <Link 
            href="/locations" 
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition"
          >
            Warehouses & Branches
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Categories</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><FolderTree className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{categories.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">Full taxonomy tree</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Root Departments</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><Layers className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{roots.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">Top-level parent categories</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sub-Categories</span>
            <span className="p-2 rounded-xl bg-violet-50 text-violet-600"><Sparkles className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{Math.max(0, categories.length - roots.length)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Nested classification depth</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tagged Products</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600"><Boxes className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{categorizedProductsCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Linked in inventory</p>
        </div>
      </div>

      {/* Add Top-Level Category Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <FolderPlus className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">Add Top-Level Category</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Create primary departments (e.g. Beverages, Electronics, Hardware). You can add nested sub-categories later under each.
        </p>

        <form onSubmit={handleAddRoot} className="flex flex-col sm:flex-row gap-3">
          <input
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
            placeholder="e.g. Grocery, Stationery, Footwear..."
            value={rootName}
            onChange={(e) => setRootName(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={!rootName.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-2xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> Create Category
          </button>
        </form>
      </div>

      {/* Categories Tree Explorer */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Category Hierarchy</h2>
            <p className="text-xs text-slate-500">Click arrows to expand or collapse subcategories. Hover over any item to edit or add children.</p>
          </div>
          <span className="text-xs font-bold text-slate-500 px-3 py-1 bg-slate-100 rounded-xl">
            {roots.length} {roots.length === 1 ? 'Root Node' : 'Root Nodes'}
          </span>
        </div>

        {roots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-500 flex items-center justify-center mb-4">
              <FolderTree className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">No Categories Created Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mb-6">
              Organizing your items into categories makes POS checkout and inventory tracking much faster.
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100/80">
            {roots.map((root) => (
              <div key={root.syncId} className="py-2 first:pt-0 last:pb-0">
                <CategoryNode
                  category={root}
                  childrenByParentId={childrenByParentId}
                  depth={0}
                  onAddChild={handleAddChild}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
