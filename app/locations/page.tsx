'use client';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Location } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { 
  ArrowLeft, MapPin, Building2, Store, Warehouse, 
  Plus, CheckCircle2, ShieldAlert, FolderTree, Package, Trash2
} from 'lucide-react';

const LOCATION_TYPE_OPTIONS: { value: NonNullable<Location['locationType']>; label: string; icon: any }[] = [
  { value: 'WAREHOUSE', label: 'Warehouse', icon: Warehouse },
  { value: 'BRANCH', label: 'Branch', icon: Building2 },
  { value: 'SHOP', label: 'Shop / Outlet', icon: Store },
  { value: 'OTHER', label: 'Other Facility', icon: MapPin },
];

export default function LocationsPage() {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [locationType, setLocationType] = useState<NonNullable<Location['locationType']>>('BRANCH');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const locations = useLiveQuery(() => db.locations.filter((l) => !l.isDeleted).toArray()) || [];

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const newLocation: Location = {
        syncId: crypto.randomUUID(),
        name: name.trim(),
        locationType,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        isActive: true,
        isDeleted: false,
        companyCode: user?.companyCode,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.locations.add(newLocation as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      setName('');
      setLocationType('BRANCH');
      setAddress('');
      setCity('');

      SyncService.sync();
    } catch (error) {
      console.error(error);
      alert('Failed to create location');
    }
  };

  const toggleActive = async (loc: Location) => {
    if (!loc.id) return;
    await db.locations.update(loc.id, { isActive: !loc.isActive, updatedAt: new Date() });
    SyncService.sync();
  };

  const handleDelete = async (loc: Location) => {
    if (!loc.id) return;
    if (!confirm(`Delete location "${loc.name}"? Products/customers tagged with it will keep working, just unassigned.`)) return;
    await db.locations.update(loc.id, { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() });
    SyncService.sync();
  };

  const activeCount = locations.filter((l) => l.isActive).length;
  const warehouseCount = locations.filter((l) => l.locationType === 'WAREHOUSE').length;
  const shopCount = locations.filter((l) => l.locationType === 'SHOP').length;

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-8 pb-24 max-w-6xl mx-auto flex flex-col gap-6 text-slate-800">
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
              <span className="text-indigo-600 font-bold">Locations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="p-2 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                <MapPin className="w-6 h-6" />
              </span>
              Locations & Facilities
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link 
            href="/inventory" 
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition flex items-center gap-1.5"
          >
            <Package className="w-4 h-4 text-slate-400" />
            Stock Catalog
          </Link>
          <Link 
            href="/categories" 
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition flex items-center gap-1.5"
          >
            <FolderTree className="w-4 h-4 text-slate-400" />
            Categories Tree
          </Link>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sites</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><MapPin className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{locations.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">Configured facilities</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Status</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{activeCount}</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Operational hubs</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Warehouses</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600"><Warehouse className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{warehouseCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Bulk storage & depots</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Retail Shops</span>
            <span className="p-2 rounded-xl bg-violet-50 text-violet-600"><Store className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{shopCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Countertop retail outlets</p>
        </div>
      </div>

      {/* Main Responsive Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Add Location Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 p-6 sm:p-7 rounded-3xl shadow-sm">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Add New Location</h2>
              <p className="text-xs text-slate-500">Register a warehouse, branch, or storefront</p>
            </div>
          </div>

          <form onSubmit={handleCreateLocation} className="flex flex-col gap-4 mt-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Location Name *
              </label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                placeholder="e.g. Central Warehouse, Saddar Branch"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Facility Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {LOCATION_TYPE_OPTIONS.map((opt) => {
                  const IconComp = opt.icon;
                  const isSelected = locationType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLocationType(opt.value)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <IconComp className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Physical Street Address (Optional)
              </label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                placeholder="e.g. Plot 42, Industrial Area, Sector I-9"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                City / Region (Optional)
              </label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                placeholder="e.g. Lahore, Karachi, Rawalpindi"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={!name.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 mt-2"
            >
              <Plus className="w-4 h-4" /> Save Facility
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Location Directory */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 p-6 sm:p-7 rounded-3xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Facility Directory</h2>
              <p className="text-xs text-slate-500">Track and manage your multi-location stock hubs</p>
            </div>
            <span className="text-xs font-bold text-slate-500 px-3 py-1 bg-slate-100 rounded-xl">
              {locations.length} {locations.length === 1 ? 'Location' : 'Locations'}
            </span>
          </div>

          {locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-500 flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">No Locations Configured</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Add your main warehouse or shop on the left to start assigning products and shipments to distinct physical hubs.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {locations.map((loc) => {
                const isWh = loc.locationType === 'WAREHOUSE';
                const isShop = loc.locationType === 'SHOP';

                return (
                  <div 
                    key={loc.id} 
                    className="bg-slate-50/80 border border-slate-200/80 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-slate-50 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        isWh 
                          ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                          : isShop 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                      }`}>
                        {isWh ? <Warehouse className="w-5 h-5" /> : isShop ? <Store className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900">{loc.name}</h3>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            isWh 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : isShop 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {loc.locationType}
                          </span>
                          {!loc.isActive && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {[loc.address, loc.city].filter(Boolean).join(', ') || 'No physical address specified'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(loc)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors shadow-xs ${
                          loc.isActive 
                            ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' 
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {loc.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(loc)}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold transition-colors"
                        title="Delete location"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
