'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import { SyncService } from '@/services/SyncService';
import { Factory, Plus, Wrench, PackagePlus, ArrowLeft, History, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { getTerm } from '@/lib/terminology';

export default function ProductionPage() {
  const { user } = useAuthStore();
  const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray()) || [];
  const boms = useLiveQuery(() => db.boms.filter(b => !b.isDeleted).toArray()) || [];
  const logs = useLiveQuery(() => db.productionLogs.filter(l => !l.isDeleted).reverse().limit(20).toArray()) || [];

  const [showBomModal, setShowBomModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);

  // BOM Form
  const [finishedProductId, setFinishedProductId] = useState('');
  const [rawMaterials, setRawMaterials] = useState<{productId: string, qty: number}[]>([]);

  // Production Run Form
  const [runProductId, setRunProductId] = useState('');
  const [runQty, setRunQty] = useState('');

  const handleSaveBom = async () => {
    if (!finishedProductId || rawMaterials.length === 0) return;
    await db.boms.add({
      syncId: crypto.randomUUID(),
      finishedProductId,
      rawMaterials: JSON.stringify(rawMaterials)
    });
    SyncService.sync();
    setShowBomModal(false);
    setFinishedProductId(''); setRawMaterials([]);
  };

  const handleRunProduction = async () => {
    if (!runProductId || !runQty) return;
    const bom = boms.find(b => b.finishedProductId === runProductId);
    if (!bom) return alert('No Recipe (BOM) found for this product!');

    const qtyToProduce = Number(runQty);
    const materialsNeeded = bom.rawMaterials ? (JSON.parse(bom.rawMaterials) as {productId: string, qty: number}[]) : [];
    
    await db.transaction('rw', db.products, db.stockMovements, db.productionLogs, db.auditLogs, async () => {
      // 1. Deduct Raw Materials
      for (const mat of materialsNeeded) {
        const prod = await db.products.where('syncId').equals(mat.productId).first();
        if (prod) {
          const totalDeduct = mat.qty * qtyToProduce;
          await db.products.update(prod.id!, { stockQuantity: (prod.stockQuantity || 0) - totalDeduct });
          await db.stockMovements.add({
            syncId: crypto.randomUUID(),
            productId: prod.syncId!,
            type: 'OUT',
            quantity: totalDeduct,
            date: new Date().toISOString(),
            note: `Consumed for Production Run of ${qtyToProduce} units`
          });
        }
      }

      // 2. Add Finished Goods
      const finishedProd = await db.products.where('syncId').equals(runProductId).first();
      if (finishedProd) {
        await db.products.update(finishedProd.id!, { stockQuantity: (finishedProd.stockQuantity || 0) + qtyToProduce });
        await db.stockMovements.add({
          syncId: crypto.randomUUID(),
          productId: finishedProd.syncId!,
          type: 'IN',
          quantity: qtyToProduce,
          date: new Date().toISOString(),
          note: 'Manufactured Batch'
        });
      }

      // 3. Log Production
      const syncId = crypto.randomUUID();
      await db.productionLogs.add({
        syncId,
        finishedProductId: runProductId,
        quantityProduced: qtyToProduce,
        date: new Date().toISOString(),
        loggedBy: user?.fullName || 'SYSTEM'
      });

      // 4. Audit Log
      await db.auditLogs.add({
        syncId: crypto.randomUUID(),
        action: 'CREATE',
        entity: 'PRODUCTION',
        entityId: syncId,
        userId: user?.id?.toString() || 'SYSTEM',
        details: JSON.stringify({ product: finishedProd?.name, qty: qtyToProduce }),
        timestamp: new Date().toISOString()
      });
    });

    SyncService.sync();
    setShowRunModal(false);
    setRunProductId(''); setRunQty('');
    alert('Production Run Successful! Inventory automatically adjusted.');
  };

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 flex items-center justify-between z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Factory className="w-5 h-5 text-indigo-600" /> Production & Assembly Engine
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBomModal(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
            <Wrench className="w-4 h-4" /> Create Recipe (BOM)
          </button>
          <button onClick={() => setShowRunModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-indigo-200">
            <PackagePlus className="w-4 h-4" /> Run Production
          </button>
        </div>
      </header>

      <div className="p-4 lg:p-8 max-w-6xl mx-auto flex flex-col gap-6 w-full">
        
        <div className="bg-gradient-to-r from-indigo-900 to-violet-900 text-white p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500 text-white">NEW</span>
              <h2 className="text-white font-black text-lg">Full-Scale Factory OS (MRP/APS + MES)</h2>
            </div>
            <p className="text-indigo-200 text-xs max-w-xl">
              Switch to the advanced factory suite featuring Multi-Level Recursive BOMs, Capacity-Aware APS Scheduling, MES Floor Terminal with rugged touchscreen controls, and Live OEE analytics.
            </p>
          </div>
          <Link
            href="/factory"
            className="px-5 py-2.5 bg-white text-indigo-900 hover:bg-indigo-50 font-black text-sm rounded-xl transition-colors shrink-0 text-center shadow-md"
          >
            Launch Factory OS &rarr;
          </Link>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-2xl flex items-start gap-4">
          <ShieldAlert className="w-8 h-8 text-indigo-600 shrink-0" />
          <div>
            <h2 className="text-indigo-900 font-bold text-lg">Smart Manufacturing Engine</h2>
            <p className="text-indigo-700 text-sm mt-1">
              Welcome to the Mini Factory core. First, create a <b>Recipe (BOM)</b> to define what raw materials make up a finished product. 
              Then, click <b>Run Production</b>. The system will automatically deduct raw materials from {getTerm(user, 'inventory')} and instantly add finished goods to your stock!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Active Recipes (BOMs) */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-500" /> Active Recipes / BOMs
            </h3>
            <div className="flex flex-col gap-4">
              {boms.length === 0 && <p className="text-slate-500 text-sm">No manufacturing recipes created yet.</p>}
              {boms.map(bom => {
                const finishedGood = products.find(p => p.syncId === bom.finishedProductId);
                const materials = bom.rawMaterials ? (JSON.parse(bom.rawMaterials) as {productId: string, qty: number}[]) : [];
                return (
                  <div key={bom.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold uppercase">Produces</div>
                      <span className="font-black text-slate-800">{finishedGood?.name || 'Unknown Product'}</span>
                    </div>
                    <div className="pl-4 border-l-2 border-indigo-200 flex flex-col gap-1">
                      {materials.map((m, i) => {
                        const mat = products.find(p => p.syncId === m.productId);
                        return <p key={i} className="text-sm text-slate-600 font-semibold">{m.qty}x {mat?.name || 'Unknown Material'}</p>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Production Runs */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-500" /> Recent Production Runs
            </h3>
            <div className="flex flex-col gap-4">
              {logs.length === 0 && <p className="text-slate-500 text-sm">No production runs logged yet.</p>}
              {logs.map(log => {
                const finishedGood = products.find(p => p.syncId === log.finishedProductId);
                return (
                  <div key={log.id} className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div>
                      <p className="font-bold text-slate-800">Manufactured: {finishedGood?.name}</p>
                      <p className="text-xs text-slate-500">{new Date(log.date).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-600">+{log.quantityProduced} Units</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">By {log.loggedBy}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* BOM Modal */}
      {showBomModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-slate-800">Create Manufacturing Recipe</h2>
            
            <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Finished Product (To Manufacture)</label>
                <select value={finishedProductId} onChange={e => setFinishedProductId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none mt-1">
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.syncId}>{p.name}</option>)}
                </select>
              </div>

              <div className="border-t border-slate-200 pt-4 mt-2">
                <label className="text-xs font-bold text-slate-500 uppercase flex justify-between items-center mb-2">
                  <span>Raw Materials Consumed</span>
                  <button onClick={() => setRawMaterials([...rawMaterials, {productId: '', qty: 1}])} className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded">Add Material</button>
                </label>
                
                {rawMaterials.map((rm, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <select value={rm.productId} onChange={e => {
                      const newRm = [...rawMaterials];
                      newRm[idx].productId = e.target.value;
                      setRawMaterials(newRm);
                    }} className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none">
                      <option value="">Select raw material...</option>
                      {products.map(p => <option key={p.id} value={p.syncId}>{p.name}</option>)}
                    </select>
                    <input type="number" placeholder="Qty" value={rm.qty} onChange={e => {
                      const newRm = [...rawMaterials];
                      newRm[idx].qty = Number(e.target.value);
                      setRawMaterials(newRm);
                    }} className="w-20 bg-white border border-slate-200 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none" />
                    <button onClick={() => setRawMaterials(rawMaterials.filter((_, i) => i !== idx))} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg">X</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => setShowBomModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl">Cancel</button>
              <button onClick={handleSaveBom} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200">Save Recipe</button>
            </div>
          </div>
        </div>
      )}

      {/* RUN Modal */}
      {showRunModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-slate-800">Run Production Batch</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Product to Manufacture</label>
                <select value={runProductId} onChange={e => setRunProductId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none mt-1">
                  <option value="">Select recipe...</option>
                  {boms.map(b => {
                    const p = products.find(x => x.syncId === b.finishedProductId);
                    return <option key={b.id} value={b.finishedProductId}>{p?.name}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Quantity to Produce</label>
                <input type="number" value={runQty} onChange={e => setRunQty(e.target.value)} placeholder="e.g. 50" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none mt-1" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowRunModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl">Cancel</button>
              <button onClick={handleRunProduction} disabled={!runProductId || !runQty} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 disabled:opacity-50">Produce Goods</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
