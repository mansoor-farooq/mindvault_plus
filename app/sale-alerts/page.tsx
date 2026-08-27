'use client';

import { useState } from 'react';
import { db } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import { ArrowLeft, Radar, MapPin, Search, Store, ShoppingBag, Loader2, Target } from 'lucide-react';
import Link from 'next/link';

const BRANDS = ['All Brands', 'Khaadi', 'Sapphire', 'J.', 'Outfitters', 'Gul Ahmed', 'Daraz', 'Samsung'];
const CATEGORIES = ['All Categories', 'Clothing', 'Electronics', 'Food', 'Footwear', 'Groceries'];
const RADIUS_OPTIONS = [
  { label: '5 km (Default)', value: 5 },
  { label: '10 km', value: 10 },
  { label: '20 km', value: 20 },
  { label: '50 km (Whole City)', value: 50 },
];

export default function SaleRadarPage() {
  const [selectedBrand, setSelectedBrand] = useState(BRANDS[0]);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [selectedRadius, setSelectedRadius] = useState(RADIUS_OPTIONS[0].value);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = () => {
    setIsScanning(true);
    setError(null);
    setScanComplete(false);

    if (!navigator.geolocation) {
      setError('GPS is not supported by your browser.');
      setIsScanning(false);
      return;
    }

    // Get user GPS location
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // 1. Silent Data Collection for Future Ad-Targeting
          await db.saleSearchHistory.add({
            latitude,
            longitude,
            radiusKm: selectedRadius,
            brand: selectedBrand,
            category: selectedCategory,
            createdAt: new Date(),
          });
          SyncService.sync();

          // 2. Simulate finding sales (Scraper API to be connected here later)
          setTimeout(() => {
            setIsScanning(false);
            setScanComplete(true);
          }, 2500);

        } catch (err) {
          console.error('Error saving radar history:', err);
          setError('Failed to scan area. Please try again.');
          setIsScanning(false);
        }
      },
      (geoError) => {
        console.error(geoError);
        setError('Please allow location access to find sales near you.');
        setIsScanning(false);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-rose-600 to-pink-600 text-white p-4 shadow-lg sticky top-0 z-10 flex items-center gap-3">
        <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Radar className="w-5 h-5" /> Sale Radar
        </h1>
      </header>

      <div className="p-4 max-w-2xl w-full mx-auto flex flex-col gap-6 mt-4">
        
        {/* Radar UI Illustration */}
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative flex items-center justify-center">
            <div className={\bsolute w-32 h-32 bg-rose-100 rounded-full \\}></div>
            <div className="z-10 bg-white p-6 rounded-full shadow-xl shadow-rose-200 border-4 border-rose-50">
              <Radar className={\w-12 h-12 text-rose-500 \\} />
            </div>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-800 tracking-tight">Scan for Discounts</h2>
          <p className="text-gray-500 text-sm mt-1 text-center px-4">
            Find the biggest sales happening around you right now.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-center gap-2">
            <MapPin className="w-5 h-5" /> {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-5">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Target className="w-4 h-4" /> Distance
            </label>
            <select 
              value={selectedRadius} 
              onChange={e => setSelectedRadius(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 font-medium text-gray-700 outline-none focus:border-rose-500 transition-colors"
            >
              {RADIUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Store className="w-4 h-4" /> Brand
              </label>
              <select 
                value={selectedBrand} 
                onChange={e => setSelectedBrand(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 font-medium text-gray-700 outline-none focus:border-rose-500 transition-colors"
              >
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="flex-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ShoppingBag className="w-4 h-4" /> Category
              </label>
              <select 
                value={selectedCategory} 
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 font-medium text-gray-700 outline-none focus:border-rose-500 transition-colors"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button 
            onClick={handleScan}
            disabled={isScanning}
            className="w-full mt-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-lg p-4 rounded-xl shadow-lg shadow-rose-200 hover:shadow-rose-300 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:transform-none flex items-center justify-center gap-2"
          >
            {isScanning ? (
              <><Loader2 className="w-6 h-6 animate-spin" /> Scanning Area...</>
            ) : (
              <><Search className="w-6 h-6" /> Find Sales Now</>
            )}
          </button>
        </div>

        {/* Fake Results Placeholder */}
        {scanComplete && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 text-center animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-emerald-800 font-bold text-lg">Scan Complete!</h3>
            <p className="text-emerald-600 text-sm mt-2">
              Our automated web scrapers are currently being deployed. Very soon, this screen will populate with live sales from {selectedBrand} within {selectedRadius}km!
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
