'use client';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';

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
    getRow(UNASSIGNED_KEY, 'Unassigned');

    // Supply/sale quantity + delivery cost, from stock movements (locationId on the movement itself)
    for (const sm of stockMovements) {
      const key = sm.locationId || UNASSIGNED_KEY;
      const name = sm.locationId ? locations.find((l) => l.syncId === sm.locationId)?.name || 'Unknown Location' : 'Unassigned';
      const row = getRow(key, name);
      if (sm.type === 'STOCK_IN') row.supplyQty += Number(sm.quantity) || 0;
      else if (sm.type === 'STOCK_OUT') row.saleQty += Number(sm.quantity) || 0;
      if (sm.deliveryCost) row.deliveryCost += Number(sm.deliveryCost) || 0;
    }

    // Sales value, from khata transactions attributed via customer -> location (CREDIT = credit
    // given to the customer, i.e. a sale on account - same convention used on the Khata page).
    const customerLocationMap = new Map(khataCustomers.map((c) => [c.syncId, c.locationId]));
    for (const txn of khataTransactions) {
      if (txn.type !== 'CREDIT') continue;
      const locationId = customerLocationMap.get(txn.customerId);
      const key = locationId || UNASSIGNED_KEY;
      const name = locationId ? locations.find((l) => l.syncId === locationId)?.name || 'Unknown Location' : 'Unassigned';
      const row = getRow(key, name);
      row.salesValue += Number(txn.amount) || 0;
    }

    // Sort: named locations first (by supply+sale desc), Unassigned always last
    const named = Array.from(byKey.values()).filter((r) => r.key !== UNASSIGNED_KEY);
    const unassigned = byKey.get(UNASSIGNED_KEY)!;
    named.sort((a, b) => (b.supplyQty + b.saleQty + b.salesValue) - (a.supplyQty + a.saleQty + a.salesValue));
    return [...named, unassigned];
  }, [locations, stockMovements, khataCustomers, khataTransactions]);

  const maxQty = Math.max(1, ...rows.map((r) => Math.max(r.supplyQty, r.saleQty)));
  const maxCost = Math.max(1, ...rows.map((r) => r.deliveryCost));
  const totalDeliveryCost = rows.reduce((sum, r) => sum + r.deliveryCost, 0);
  const totalSalesValue = rows.reduce((sum, r) => sum + r.salesValue, 0);

  const hasAnyData = products.length > 0 || stockMovements.length > 0 || khataTransactions.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-20 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <h1 className="text-2xl text-white font-bold">Area-wise Analytics</h1>
      </div>

      {locations.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm rounded-xl p-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          You haven&apos;t added any locations yet.{' '}
          <Link href="/locations" className="underline font-bold">Add one</Link> to start seeing area-wise breakdowns.
        </div>
      )}

      {!hasAnyData ? (
        <p className="text-gray-500 text-sm">No inventory or khata activity yet - numbers will show up here once you start logging stock and sales.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-white/5 p-4 rounded-xl">
              <span className="text-xs text-gray-400 block mb-1">Total Khata Sales Value</span>
              <span className="text-xl font-black text-emerald-400">Rs {totalSalesValue.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900 border border-white/5 p-4 rounded-xl">
              <span className="text-xs text-gray-400 block mb-1">Total Delivery/Fuel Cost</span>
              <span className="text-xl font-black text-orange-400">Rs {totalDeliveryCost.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {rows.map((row) => {
              const delta = row.supplyQty - row.saleQty;
              return (
                <div key={row.key} className="bg-slate-900 border border-white/5 p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className={`font-bold ${row.key === UNASSIGNED_KEY ? 'text-gray-500' : 'text-white'}`}>{row.name}</h3>
                    <span className={`text-xs font-bold ${delta > 0 ? 'text-blue-400' : delta < 0 ? 'text-rose-400' : 'text-gray-500'}`}>
                      {delta === 0 ? 'Balanced' : delta > 0 ? `+${delta} more supply` : `${Math.abs(delta)} more sold than supplied`}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-gray-400 flex-shrink-0">Supply</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(row.supplyQty / maxQty) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right text-blue-400 font-bold flex-shrink-0">{row.supplyQty}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-gray-400 flex-shrink-0">Sale (qty)</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(row.saleQty / maxQty) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right text-emerald-400 font-bold flex-shrink-0">{row.saleQty}</span>
                    </div>
                    {row.deliveryCost > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-16 text-gray-400 flex-shrink-0">Fuel/Del.</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(row.deliveryCost / maxCost) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right text-orange-400 font-bold flex-shrink-0">Rs {row.deliveryCost.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {row.salesValue > 0 && (
                    <p className="text-xs text-gray-400">Khata sales value: <span className="text-emerald-400 font-bold">Rs {row.salesValue.toLocaleString()}</span></p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
