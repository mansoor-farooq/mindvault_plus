'use client';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import Link from 'next/link';
import { 
  ArrowLeft, MapPin, TrendingUp, Truck, PackageCheck, 
  ArrowUpRight, ArrowDownLeft, Building2, AlertCircle, BarChart3, Package
} from 'lucide-react';

const UNASSIGNED_KEY = '__unassigned__';

interface LocationRow {
  key: string;
  name: string;
  supplyQty: number;
  saleQty: number;
  salesValue: number;
  deliveryCost: number;
}

export default function AnalyticsPage() {
  const locations = useLiveQuery(() => db.locations.filter((l) => !l.isDeleted).toArray()) || [];
  const products = useLiveQuery(() => db.products.filter((p) => !p.isDeleted).toArray()) || [];
  const stockMovements = useLiveQuery(() => db.stockMovements.filter((sm) => !sm.isDeleted).toArray()) || [];
  const khataCustomers = useLiveQuery(() => db.khataCustomers.filter((c) => !c.isDeleted).toArray()) || [];
  const khataTransactions = useLiveQuery(() => db.khataTransactions.filter((t) => !t.isDeleted).toArray()) || [];
  const invoices = useLiveQuery(() => db.invoices.filter((i) => !i.isDeleted).toArray()) || [];

  const rows: LocationRow[] = useMemo(() => {
    const byKey = new Map<string, LocationRow>();

    const getRow = (key: string, name: string) => {
      let row = byKey.get(key);
      if (!row) {
        row = { key, name, supplyQty: 0, saleQty: 0, salesValue: 0, deliveryCost: 0 };
        byKey.set(key, row);
      }
      return row;
    };

    for (const loc of locations) {
      getRow(loc.syncId!, loc.name);
    }
    getRow(UNASSIGNED_KEY, 'Unassigned / Counter');

    // Supply/sale quantity + delivery cost, from stock movements
    for (const sm of stockMovements) {
      const key = sm.locationId || UNASSIGNED_KEY;
      const name = sm.locationId ? locations.find((l) => l.syncId === sm.locationId)?.name || 'Unknown Location' : 'Unassigned / Counter';
      const row = getRow(key, name);
      if (sm.type === 'STOCK_IN' || sm.type === 'IN') row.supplyQty += Number(sm.quantity) || 0;
      else if (sm.type === 'STOCK_OUT' || sm.type === 'OUT') row.saleQty += Number(sm.quantity) || 0;
      if (sm.deliveryCost) row.deliveryCost += Number(sm.deliveryCost) || 0;
    }

    const customerLocationMap = new Map(khataCustomers.map((c) => [c.syncId, c.locationId]));

    // Sales from POS Invoices
    for (const inv of invoices) {
      const locationId = inv.customerId ? customerLocationMap.get(inv.customerId) : undefined;
      const key = locationId || UNASSIGNED_KEY;
      const name = locationId ? locations.find((l) => l.syncId === locationId)?.name || 'Unknown Location' : 'Walk-in / Counter';
      const row = getRow(key, name);
      row.salesValue += Number(inv.total) || 0;
    }

    // Direct Khata credit sales (excluding auto-generated from invoices to prevent double-counting)
    for (const txn of khataTransactions) {
      if (txn.type !== 'CREDIT' && txn.type !== 'GIVEN') continue;
      if (txn.description && txn.description.includes('Auto-added from Invoice')) continue;
      const locationId = customerLocationMap.get(txn.customerId);
      const key = locationId || UNASSIGNED_KEY;
      const name = locationId ? locations.find((l) => l.syncId === locationId)?.name || 'Unknown Location' : 'Walk-in / Counter';
      const row = getRow(key, name);
      row.salesValue += Number(txn.amount) || 0;
    }

    // Sort: named locations first (by supply+sale desc), Unassigned always last
    const named = Array.from(byKey.values()).filter((r) => r.key !== UNASSIGNED_KEY);
    const unassigned = byKey.get(UNASSIGNED_KEY)!;
    named.sort((a, b) => (b.supplyQty + b.saleQty + b.salesValue) - (a.supplyQty + a.saleQty + a.salesValue));
    return [...named, unassigned];
  }, [locations, stockMovements, khataCustomers, khataTransactions, invoices]);

  const maxQty = Math.max(1, ...rows.map((r) => Math.max(r.supplyQty, r.saleQty)));
  const maxCost = Math.max(1, ...rows.map((r) => r.deliveryCost));
  const totalDeliveryCost = rows.reduce((sum, r) => sum + r.deliveryCost, 0);
  const totalSalesValue = rows.reduce((sum, r) => sum + r.salesValue, 0);
  const totalSupplied = rows.reduce((sum, r) => sum + r.supplyQty, 0);
  const totalSold = rows.reduce((sum, r) => sum + r.saleQty, 0);

  const hasAnyData = products.length > 0 || stockMovements.length > 0 || khataTransactions.length > 0 || invoices.length > 0;

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-8 pb-24 max-w-6xl mx-auto flex flex-col gap-6 text-slate-800">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Link 
            href="/" 
            className="p-2.5 bg-white rounded-2xl border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-sm"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-0.5">
              <span>Workspace</span>
              <span>/</span>
              <span>Inventory</span>
              <span>/</span>
              <span className="text-indigo-600 font-bold">Area Analytics</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="p-2 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                <BarChart3 className="w-6 h-6" />
              </span>
              Area-Wise Supply & Sales
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link 
            href="/locations" 
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition"
          >
            Facility Directory
          </Link>
          <Link 
            href="/inventory" 
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition"
          >
            Inventory Stock
          </Link>
        </div>
      </div>

      {locations.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p>
            You have not configured distinct branches or warehouses yet.{' '}
            <Link href="/locations" className="underline font-bold text-amber-950">Add a location</Link> to start seeing geographic stock & delivery breakdowns.
          </p>
        </div>
      )}

      {/* KPI Overview Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sales</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><TrendingUp className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">Rs {totalSalesValue.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">POS & Khata sales value</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Overheads</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600"><Truck className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">Rs {totalDeliveryCost.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-1">Fuel and transit costs</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Units Supplied</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><ArrowDownLeft className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{totalSupplied.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-1">Inward restock movements</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Units Dispatched</span>
            <span className="p-2 rounded-xl bg-violet-50 text-violet-600"><ArrowUpRight className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{totalSold.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-1">Outward sales volume</p>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-16 text-center shadow-sm flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-500 flex items-center justify-center mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No Activity Logged Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Area breakdowns will automatically populate once you start logging stock deliveries or sales receipts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((row) => {
            const delta = row.supplyQty - row.saleQty;
            const isUnassigned = row.key === UNASSIGNED_KEY;

            return (
              <div 
                key={row.key} 
                className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className={`p-2 rounded-xl ${isUnassigned ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>
                      {isUnassigned ? <MapPin className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{row.name}</h3>
                      <p className="text-[11px] text-slate-400">{isUnassigned ? 'Direct countertop' : 'Location hub'}</p>
                    </div>
                  </div>

                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    delta === 0 
                      ? 'bg-slate-100 text-slate-600 border-slate-200' 
                      : delta > 0 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100' 
                      : 'bg-amber-50 text-amber-700 border-amber-100'
                  }`}>
                    {delta === 0 ? 'Balanced' : delta > 0 ? `+${delta} net inflow` : `${Math.abs(delta)} net outflow`}
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {/* Supply Row */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="w-20 text-slate-500 font-semibold shrink-0 flex items-center gap-1">
                      <ArrowDownLeft className="w-3.5 h-3.5 text-indigo-600" /> Inflow
                    </span>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                        style={{ width: `${(row.supplyQty / maxQty) * 100}%` }} 
                      />
                    </div>
                    <span className="w-14 text-right text-indigo-600 font-bold shrink-0">
                      {row.supplyQty.toLocaleString()}
                    </span>
                  </div>

                  {/* Sale Row */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="w-20 text-slate-500 font-semibold shrink-0 flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" /> Outflow
                    </span>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500" 
                        style={{ width: `${(row.saleQty / maxQty) * 100}%` }} 
                      />
                    </div>
                    <span className="w-14 text-right text-emerald-600 font-bold shrink-0">
                      {row.saleQty.toLocaleString()}
                    </span>
                  </div>

                  {/* Delivery Cost Row */}
                  {row.deliveryCost > 0 && (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="w-20 text-slate-500 font-semibold shrink-0 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-amber-600" /> Transit
                      </span>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                          style={{ width: `${(row.deliveryCost / maxCost) * 100}%` }} 
                        />
                      </div>
                      <span className="w-20 text-right text-amber-600 font-bold shrink-0">
                        Rs {row.deliveryCost.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {row.salesValue > 0 && (
                  <div className="mt-1 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Area Revenue Generated:</span>
                    <span className="text-emerald-600 font-black text-sm">
                      Rs {row.salesValue.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
