'use client';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Location } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const LOCATION_TYPE_OPTIONS: { value: NonNullable<Location['locationType']>; label: string }[] = [
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'BRANCH', label: 'Branch' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'OTHER', label: 'Other' },
];

export default function LocationsPage() {
  const [name, setName] = useState('');
  const [locationType, setLocationType] = useState<NonNullable<Location['locationType']>>('BRANCH');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const locations = useLiveQuery(() => db.locations.filter((l) => !l.isDeleted).toArray()) || [];

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const newLocation: Location = {
        name,
        locationType,
        address: address || undefined,
        city: city || undefined,
        isActive: true,
        isDeleted: false,
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

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-20 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/inventory" className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <h1 className="text-2xl text-white font-bold">Locations / Branches</h1>
      </div>

      <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-6 lg:items-start flex flex-col gap-6">
      <div className="bg-slate-900 border border-white/5 p-4 rounded-xl">
        <h2 className="text-lg text-white font-bold mb-4">Add Location</h2>
        <form onSubmit={handleCreateLocation} className="flex flex-col gap-3">
          <input
            className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
            placeholder="Location Name (e.g. Main Warehouse)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="flex gap-2 flex-wrap">
            {LOCATION_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLocationType(opt.value)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  locationType === opt.value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <input
            className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
            placeholder="Address (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <input
            className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
            placeholder="City (optional)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />

          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg mt-2 transition">
            Save Location
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg text-white font-bold mb-3">Your Locations</h2>
        {locations.length === 0 ? (
          <p className="text-gray-500">No locations yet. Add your first warehouse or branch above.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {locations.map((loc) => (
              <div key={loc.id} className="bg-white/5 border border-white/10 p-3 rounded-xl flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium">{loc.name}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {loc.locationType}
                    </span>
                    {!loc.isActive && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">
                    {[loc.address, loc.city].filter(Boolean).join(', ') || 'No address set'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(loc)}
                    className="bg-white/10 hover:bg-white/20 transition text-gray-300 text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    {loc.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(loc)}
                    className="bg-red-500/20 hover:bg-red-500/40 transition text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
