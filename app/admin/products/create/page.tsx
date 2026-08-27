"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { ArrowLeft, Upload, CheckCircle2, DollarSign, Tag, Box } from 'lucide-react';

export default function CreateProductPage() {
  const router = useRouter();
  const { palette, mode } = useAdminTheme();
  const [productData, setProductData] = useState({
    title: '',
    sku: '',
    category: 'Electronics',
    regularPrice: '',
    salePrice: '',
    stockQuantity: '50',
    description: '',
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      router.push('/admin/products');
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/products"
          className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Add New Product</h1>
          <p className="text-xs text-gray-400">Fill in store catalog details, pricing & inventory</p>
        </div>
      </div>

      {submitted && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <span>Product created successfully! Redirecting to catalog...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Images Dropzone */}
        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col items-center justify-center text-center ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="w-full h-44 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors bg-gray-50/50 dark:bg-gray-900/50">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-xs font-bold">Drop product images here</span>
            <span className="text-[10px] text-gray-400 mt-1">or browse files</span>
          </div>
        </div>

        {/* Product Details */}
        <div className={`md:col-span-2 p-6 rounded-3xl border shadow-sm space-y-6 ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-400">Product Title</label>
              <input
                type="text"
                required
                value={productData.title}
                onChange={(e) => setProductData({ ...productData, title: e.target.value })}
                placeholder="e.g. iPhone 15 Pro Max 256GB"
                className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400">SKU Code</label>
              <input
                type="text"
                required
                value={productData.sku}
                onChange={(e) => setProductData({ ...productData, sku: e.target.value })}
                placeholder="SKU-8949"
                className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400">Category</label>
              <select
                value={productData.category}
                onChange={(e) => setProductData({ ...productData, category: e.target.value })}
                className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none"
              >
                <option>Electronics</option>
                <option>Laptops</option>
                <option>Audio</option>
                <option>Wearables</option>
                <option>Tablets</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400">Regular Price ($)</label>
              <input
                type="number"
                required
                value={productData.regularPrice}
                onChange={(e) => setProductData({ ...productData, regularPrice: e.target.value })}
                placeholder="999.00"
                className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400">Stock Quantity</label>
              <input
                type="number"
                required
                value={productData.stockQuantity}
                onChange={(e) => setProductData({ ...productData, stockQuantity: e.target.value })}
                className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400">Product Specification / Description</label>
            <textarea
              rows={4}
              value={productData.description}
              onChange={(e) => setProductData({ ...productData, description: e.target.value })}
              placeholder="Enter comprehensive product features, dimensions and specs..."
              className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none focus:border-primary"
            />
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg transition-transform hover:scale-105"
              style={{ background: palette.accentGradient }}
            >
              Publish Product to Store
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
