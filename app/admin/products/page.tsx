"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { Package, PackagePlus, Search, Grid, List, Star, MoreVertical, Trash2, Edit } from 'lucide-react';

interface ProductItem {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: string;
  stock: number;
  maxStock: number;
  rating: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  icon: string;
}

const SAMPLE_PRODUCTS: ProductItem[] = [
  { id: '1', name: 'iPhone 15 Pro Max (256GB)', category: 'Electronics', sku: 'SKU-8941', price: '$1,199.00', stock: 45, maxStock: 100, rating: 4.9, status: 'In Stock', icon: '📱' },
  { id: '2', name: 'MacBook Pro M3 Max (16-inch)', category: 'Laptops', sku: 'SKU-8942', price: '$2,499.00', stock: 8, maxStock: 50, rating: 5.0, status: 'Low Stock', icon: '💻' },
  { id: '3', name: 'AirPods Max Noise Cancelling', category: 'Audio', sku: 'SKU-8943', price: '$549.00', stock: 82, maxStock: 120, rating: 4.8, status: 'In Stock', icon: '🎧' },
  { id: '4', name: 'Apple Watch Ultra 2 GPS', category: 'Wearables', sku: 'SKU-8944', price: '$799.00', stock: 0, maxStock: 60, rating: 4.7, status: 'Out of Stock', icon: '⌚' },
  { id: '5', name: 'iPad Pro 12.9" M2 Chip', category: 'Tablets', sku: 'SKU-8945', price: '$1,099.00', stock: 24, maxStock: 80, rating: 4.9, status: 'In Stock', icon: '📱' },
  { id: '6', name: 'Studio Display 27" 5K Retina', category: 'Monitors', sku: 'SKU-8946', price: '$1,599.00', stock: 4, maxStock: 30, rating: 4.6, status: 'Low Stock', icon: '🖥️' },
];

export default function ProductListPage() {
  const { palette, mode } = useAdminTheme();
  const [products, setProducts] = useState<ProductItem[]>(SAMPLE_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<'All' | 'In Stock' | 'Low Stock' | 'Out of Stock'>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const filteredProducts = products.filter((p) => {
    const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusTab === 'All' ? true : p.status === statusTab;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Product Catalog</h1>
          <p className="text-xs text-gray-400">Manage store items, inventory stock & pricing</p>
        </div>
        <Link
          href="/admin/products/create"
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-105"
          style={{ background: palette.accentGradient }}
        >
          <PackagePlus className="w-4 h-4" />
          <span>Add New Product</span>
        </Link>
      </div>

      {/* Main Container Card */}
      <div className={`rounded-3xl border shadow-sm overflow-hidden ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        {/* Status Tabs */}
        <div className="px-6 pt-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-6 text-xs font-bold">
          {(['All', 'In Stock', 'Low Stock', 'Out of Stock'] as const).map((tab) => {
            const count = tab === 'All' ? products.length : products.filter((p) => p.status === tab).length;
            const isSelected = statusTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                  isSelected ? 'border-primary' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
                style={{ borderColor: isSelected ? palette.primary : 'transparent', color: isSelected ? palette.primary : undefined }}
              >
                <span>{tab}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name or SKU..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-xs font-medium outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-white dark:bg-[#161c24] text-primary shadow' : 'text-gray-400'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-white dark:bg-[#161c24] text-primary shadow' : 'text-gray-400'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grid or Table View */}
        <div className="p-6">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800/80 bg-gray-50/30 dark:bg-gray-900/30 space-y-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-3xl shadow-sm">
                      {p.icon}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      p.status === 'In Stock'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : p.status === 'Low Stock'
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-rose-500/10 text-rose-500'
                    }`}>
                      {p.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm line-clamp-1">{p.name}</h3>
                    <p className="text-[11px] text-gray-400">{p.category} • {p.sku}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-base font-black">{p.price}</span>
                    <span className="text-xs font-bold text-amber-500">★ {p.rating}</span>
                  </div>

                  {/* Stock progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
                      <span>Stock Quantity</span>
                      <span>{p.stock} / {p.maxStock}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(p.stock / p.maxStock) * 100}%`,
                          backgroundColor: p.status === 'In Stock' ? palette.primary : p.status === 'Low Stock' ? '#ffab00' : '#ff5630',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase font-bold text-[10px]">
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3">SKU</th>
                    <th className="py-3 px-3">Price</th>
                    <th className="py-3 px-3">Stock Status</th>
                    <th className="py-3 px-3">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="py-3 px-3 font-bold flex items-center gap-3">
                        <span className="text-xl">{p.icon}</span>
                        <span>{p.name}</span>
                      </td>
                      <td className="py-3 px-3 text-gray-400">{p.sku}</td>
                      <td className="py-3 px-3 font-bold">{p.price}</td>
                      <td className="py-3 px-3">
                        <span className="font-bold">{p.stock} units ({p.status})</span>
                      </td>
                      <td className="py-3 px-3 text-amber-500 font-bold">★ {p.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
