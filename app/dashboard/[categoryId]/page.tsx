'use client';
import { use } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { getToolCategory } from '@/lib/toolCategories';
import { ArrowLeft } from 'lucide-react';
import InventoryDashboardStats from './InventoryDashboardStats';
import NotesDashboardStats from './NotesDashboardStats';
import MoneyToolsDashboardStats from './MoneyToolsDashboardStats';

export default function CategoryDashboardPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = use(params);
  const { user, featureAccess } = useAuthStore();
  const category = getToolCategory(categoryId);

  const visibleTools = (category?.tools ?? []).filter((t) => {
    if (t.showIf && !t.showIf(user)) return false;
    if (t.featureKey && featureAccess && featureAccess[t.featureKey] === false) return false;
    return true;
  });

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-gray-500">Category not found.</p>
        <Link href="/" className="text-indigo-600 font-semibold hover:underline">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 hover:bg-gray-200/60 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${category.colorClass}`}>
            <category.icon className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">{category.label}</h1>
        </div>
      </div>

      {categoryId === 'inventory' && <InventoryDashboardStats />}
      {categoryId === 'notes-ai' && <NotesDashboardStats />}
      {categoryId === 'money-tools' && <MoneyToolsDashboardStats />}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visibleTools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex flex-col items-start gap-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className={`p-2.5 rounded-xl ${category.colorClass}`}>
              <tool.icon className="w-5 h-5" />
            </div>
            <span className="font-semibold text-gray-800 text-sm">{tool.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
