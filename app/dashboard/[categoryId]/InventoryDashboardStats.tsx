'use client';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, StockMovement } from '@/lib/db';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';

const PIE_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#6366f1', '#84cc16', '#ec4899'];

export default function InventoryDashboardStats() {
  const products = useLiveQuery(() => db.products.filter((p) => !p.isDeleted).toArray()) || [];
  const stockMovements = useLiveQuery(() => db.stockMovements.filter((sm) => !sm.isDeleted).toArray()) || [];
  const locations = useLiveQuery(() => db.locations.filter((l) => !l.isDeleted).toArray()) || [];
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.isDeleted).toArray()) || [];

  const productsWithStock = useMemo(
    () =>
      products.map((p) => {
        const movements = stockMovements.filter((sm: StockMovement) => sm.productId === p.syncId);
        const currentStock = movements.reduce((acc: number, sm: StockMovement) => acc + (sm.type === 'STOCK_IN' ? Number(sm.quantity) : -Number(sm.quantity)), 0);
        return { ...p, currentStock };
      }),
    [products, stockMovements]
  );

  const lowStockCount = productsWithStock.filter((p) => p.currentStock <= p.lowStockThreshold).length;

  const stats = [
    { label: 'Products', value: products.length },
    { label: 'Low Stock', value: lowStockCount, warn: lowStockCount > 0 },
    { label: 'Locations', value: locations.length },
    { label: 'Categories', value: categories.length },
  ];

  const stockChartData = useMemo(
    () =>
      [...productsWithStock]
        .sort((a, b) => b.currentStock - a.currentStock)
        .slice(0, 8)
        .map((p) => ({ name: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name, stock: p.currentStock })),
    [productsWithStock]
  );

  const categoryChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const key = p.category || 'Uncategorized';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [products]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className={`text-lg font-black ${s.warn ? 'text-orange-500' : 'text-gray-800'}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400 font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Stock by Product</h3>
          {stockChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-xs">Add products to see stock levels here.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stockChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="stock" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Products by Category</h3>
          {categoryChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-xs">No products yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={{ fontSize: 10 }}>
                  {categoryChartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
