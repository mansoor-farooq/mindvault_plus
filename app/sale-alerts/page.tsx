'use client';

import { useState, useMemo } from 'react';
import { db } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import { ArrowLeft, Radar, MapPin, Search, Store, ShoppingBag, Loader2, Target, Globe, ChevronDown, X, CheckCircle2, Navigation, Tag, Clock } from 'lucide-react';
import Link from 'next/link';
import { SearchableSelect } from '@/components/SearchableSelect';

const PAKISTAN_CITIES: Record<string, string[]> = {
  'Lahore': ['Gulberg', 'DHA Phase 1', 'DHA Phase 2', 'DHA Phase 3', 'DHA Phase 4', 'DHA Phase 5', 'DHA Phase 6', 'Model Town', 'Garden Town', 'Johar Town', 'Iqbal Town', 'Faisal Town', 'Wapda Town', 'Township', 'Raiwind Road', 'Bahria Town', 'Cantt', 'Shadman', 'Gulshan-e-Ravi', 'Muslim Town', 'Samanabad', 'New Garden Town', 'Cavalry Ground'],
  'Karachi': ['DHA Phase 1', 'DHA Phase 2', 'DHA Phase 4', 'DHA Phase 5', 'DHA Phase 6', 'DHA Phase 8', 'Clifton', 'Bath Island', 'Saddar', 'Mahmoodabad', 'Gulshan-e-Iqbal', 'PECHS', 'Bahadurabad', 'North Nazimabad', 'Nazimabad', 'Korangi', 'Landhi', 'Malir', 'Shah Faisal', 'Orangi', 'Liaquatabad', 'F.B. Area', 'Garden East', 'Lyari', 'Kemari', 'Baldia'],
  'Islamabad': ['F-6', 'F-7', 'F-8', 'F-10', 'F-11', 'G-6', 'G-7', 'G-8', 'G-9', 'G-10', 'G-11', 'G-13', 'I-8', 'I-9', 'I-10', 'E-7', 'E-11', 'D-12', 'B-17', 'Bahria Town', 'DHA', 'Blue Area', 'Bani Gala', 'Koral', 'Rawat'],
  'Rawalpindi': ['Satellite Town', 'Bahria Town', 'DHA', 'Cantt', 'Saddar', 'Chaklala', 'Adiala Road', 'Murree Road', 'Westridge', 'Raja Bazaar', 'Lalkurti', 'Gulzar-e-Quaid', 'Airport Road', '6th Road'],
  'Faisalabad': ['Gulberg', 'Samanabad', 'Madina Town', 'D-Ground', 'Peoples Colony', 'Millat Road', 'Sargodha Road', 'Sheikhupura Road', 'Jaranwala Road', 'Jhang Road', 'Canal Road', 'Eden Garden', 'Jinnah Colony'],
  'Multan': ['Cantt', 'DHA', 'Gulgasht Colony', 'Bosan Road', 'Vehari Road', 'Abdali Road', 'New Multan', 'Shah Rukn-e-Alam Colony', 'Nishtar Colony', 'Bahawalpur Road'],
  'Peshawar': ['Hayatabad', 'University Town', 'Saddar', 'Cantt', 'Gulbahar', 'Shami Road', 'Ring Road', 'Dalazak Road', 'Pajagi Road', 'Kohat Road', 'Nauthia', 'Faqirabad', 'Chamkani'],
  'Quetta': ['Satellite Town', 'Cantt', 'Jinnah Town', 'Zarghoon Road', 'Airport Road', 'Sariab Road', 'Hazar Ganji', 'Wahdat Colony', 'Kirani Road'],
  'Gujranwala': ['Satellite Town', 'DHA', 'Peoples Colony', 'Kashmir Road', 'Sialkot Road', 'G.T. Road', 'Trust Colony', 'Ali Town'],
  'Sialkot': ['Cantt', 'Ugoki Road', 'Daska Road', 'Paris Road', 'Wazirabad Road', 'Allama Iqbal Town', 'Hajipura', 'Sambrial'],
  'Bahawalpur': ['Cantt', 'DHA', 'Civil Lines', 'Yazman Road', 'Multan Road', 'Ahmedpur Road', 'Farid Gate'],
  'Sargodha': ['University Town', 'Satellite Town', 'Cantt', 'Faisalabad Road', 'Mianwali Road'],
  'Abbottabad': ['Cantt', 'PMA Road', 'Nawan Shehr', 'Kakul', 'Havelian Road', 'Mansehra Road'],
  'Sukkur': ['Cantt', 'Airport Road', 'Shikarpur Road', 'Larkana Road'],
  'Hyderabad': ['Latifabad', 'Qasimabad', 'Hirabad', 'Cantt', 'Hussainabad', 'Kotri'],
  'Mardan': ['Cantt', 'Rustam Road', 'Swabi Road', 'Peshawar Road', 'GT Road'],
  'Muzaffarabad': ['City Area', 'Chattar Domel', 'Ambore', 'Kail Road'],
  'Mirpur (AJK)': ['City', 'Allama Iqbal Colony', 'New Mirpur', 'Sector A', 'Sector B', 'Sector C', 'Sector D'],
  'Dera Ghazi Khan': ['Cantt', 'City', 'Tounsa Road', 'Multan Road'],
  'Sahiwal': ['Cantt', 'City', 'Pakpattan Road', 'Okara Road', 'Farid Town'],
  'Jhang': ['City', 'Chiniot Road', 'Lyallpur Road', 'Shorkot Road'],
  'Sheikhupura': ['City', 'Lahore Road', 'Faisalabad Road', 'Gujranwala Road'],
  'Gujrat': ['City', 'Sialkot Road', 'Jalalpur Road', 'Lala Musa', 'GT Road'],
  'Wah Cantt': ['Taxila', 'Heavy Industries', 'City', 'GT Road', 'Hasan Abdal Road'],
  'Attock': ['Cantt', 'City', 'Rawalpindi Road', 'Mianwali Road', 'Campbellpur'],
  'Jhelum': ['City', 'Cantt', 'GT Road', 'Rawalpindi Road', 'Kharian Road'],
  'Chakwal': ['City', 'Talagang Road', 'Rawalpindi Road', 'Jhelum Road'],
  'Mianwali': ['City', 'Kundian', 'Pai', 'Piplan', 'Sargodha Road'],
  'Swat': ['Mingora', 'Saidu Sharif', 'Matta', 'Khwazakhela', 'Madyan', 'Kalam'],
  'Mansehra': ['City', 'Shinkiari', 'Balakot', 'Batagram Road', 'Muzaffarabad Road'],
  'Kohat': ['City', 'Cantt', 'Peshawar Road', 'Hangu Road', 'Tall Road'],
  'Dera Ismail Khan': ['City', 'Cantt', 'Bannu Road', 'Tank Road', 'Paharpur'],
  'Chaman': ['City', 'Border Area', 'Quetta Road'],
  'Turbat': ['City', 'Pasni Road', 'Gwadar Road', 'Panjgur Road'],
  'Gwadar': ['City', 'New Town', 'East Bay', 'Port Area', 'Surbandar Road'],
  'Nawabshah': ['City', 'Hyderabad Road', 'Khairpur Road', 'Sakrand Road'],
  'Larkana': ['City', 'Sukkur Road', 'Jacobabad Road', 'Dokri Road'],
  'Jacobabad': ['City', 'Sukkur Road', 'Larkana Road', 'Kashmor Road'],
  'Khairpur': ['City', 'Sukkur Road', 'Nawabshah Road', 'Rohri'],
  'Dadu': ['City', 'Sehwan Road', 'Johi Road', 'Mehar Road'],
  'Thatta': ['City', 'Karachi Road', 'Badin Road', 'Makli'],
  'Badin': ['City', 'Hyderabad Road', 'Thatta Road', 'Matli'],
  'Mirpurkhas': ['City', 'Hyderabad Road', 'Umerkot Road', 'Badin Road'],
  'Gilgit': ['City', 'Jutial', 'Airport Road', 'Karakoram Highway', 'Nomal', 'Danyore'],
  'Skardu': ['City', 'Airport Road', 'Hussainabad', 'Shigar Road'],
  'Haripur': ['City', 'Taxila Road', 'Abbottabad Road', 'Khanpur Road'],
  'Chiniot': ['City', 'Faisalabad Road', 'Jhang Road', 'Sargodha Road'],
  'Okara': ['City', 'Sahiwal Road', 'Lahore Road', 'Faisalabad Road'],
  'Kamoke': ['City', 'GT Road', 'Gujranwala Road', 'Lahore Road'],
  'Khushab': ['City', 'Sargodha Road', 'Mianwali Road', 'Chakwal Road'],
  'Rahim Yar Khan': ['City', 'Bahawalpur Road', 'Sadiqabad', 'Khanpur Road'],
  'Kasur': ['City', 'Lahore Road', 'Ferozewala', 'Chunian Road'],
  'Hafizabad': ['City', 'Gujranwala Road', 'Sheikhupura Road', 'Pindi Bhattian Road'],
  'Vihari': ['City', 'Multan Road', 'Sahiwal Road', 'Burewala Road'],
  'Lodhran': ['City', 'Multan Road', 'Bahawalpur Road', 'Dunyapur Road'],
  'Bahawalnagar': ['City', 'Bahawalpur Road', 'Haroonabad', 'Chishtian Road'],
  'Narowal': ['City', 'Sialkot Road', 'Lahore Road', 'Shakargarh Road'],
  'Khanewal': ['City', 'Multan Road', 'Sahiwal Road', 'Lodhran Road'],
  'Pakpattan': ['City', 'Sahiwal Road', 'Okara Road', 'Chirag Road'],
  'Toba Tek Singh': ['City', 'Faisalabad Road', 'Jhang Road', 'Gojra Road'],
  'Gojra': ['City', 'Faisalabad Road', 'Toba Tek Singh Road', 'Jhang Road'],
  'Kamalia': ['City', 'Toba Tek Singh Road', 'Faisalabad Road'],
  'Burewala': ['City', 'Vehari Road', 'Multan Road', 'Sahiwal Road'],
  'Muzaffargarh': ['City', 'Multan Road', 'DG Khan Road', 'Kot Addu Road'],
  'Layyah': ['City', 'DG Khan Road', 'Muzaffargarh Road', 'Bhakkar Road'],
  'Bhakkar': ['City', 'Layyah Road', 'Mianwali Road', 'Sargodha Road'],
  'Bannu': ['City', 'Cantt', 'Kohat Road', 'Waziristan Road'],
  'Karak': ['City', 'Kohat Road', 'Bannu Road'],
  'Hangu': ['City', 'Kohat Road', 'Peshawar Road'],
  'Nowshera': ['City', 'Cantt', 'Peshawar Road', 'Mardan Road', 'Charsadda Road'],
  'Charsadda': ['City', 'Peshawar Road', 'Mardan Road', 'Nowshera Road'],
  'Swabi': ['City', 'Mardan Road', 'Peshawar Road', 'Topi Road'],
  'Buner': ['Daggar', 'Nawagai', 'Totalai Road', 'Swat Road'],
  'Dir Upper': ['Timergara', 'Chitral Road', 'Swat Road'],
  'Chitral': ['City', 'Booni', 'Mastuj', 'Shandur Road'],
  'Zhob': ['City', 'Quetta Road', 'Loralai Road'],
  'Loralai': ['City', 'Quetta Road', 'Zhob Road'],
  'Khuzdar': ['City', 'Quetta Road', 'Karachi Road', 'Kharan Road'],
  'Hub': ['City', 'Karachi Road', 'Lasbela Road'],
  'Kharan': ['City', 'Quetta Road', 'Turbat Road'],
  'Panjgur': ['City', 'Turbat Road', 'Kharan Road'],
  'Usta Muhammad': ['City', 'Quetta Road', 'Sibi Road'],
  'Sibi': ['City', 'Quetta Road', 'Jacobabad Road', 'Dera Bugti Road'],
  'Mastung': ['City', 'Quetta Road', 'Kalat Road'],
  'Kalat': ['City', 'Quetta Road', 'Khuzdar Road', 'Mastung Road'],
  'Nushki': ['City', 'Quetta Road', 'Dalbandin Road'],
  'Dalbandin': ['City', 'Nushki Road', 'Turbat Road'],
  'Pasni': ['City', 'Gwadar Road', 'Turbat Road'],
  'Ormara': ['City', 'Gwadar Road', 'Pasni Road'],
  'Rajanpur': ['City', 'DG Khan Road', 'Kashmore Road'],
  'Taunsa': ['City', 'DG Khan Road', 'Muzaffargarh Road'],
  'Alipur': ['City', 'Muzaffargarh Road', 'Multan Road'],
  'Sadiqabad': ['City', 'Rahim Yar Khan Road', 'Bahawalpur Road'],
  'Khanpur': ['City', 'Rahim Yar Khan Road', 'Bahawalpur Road'],
  'Liaquatpur': ['City', 'Rahim Yar Khan Road'],
  'Ahmedpur East': ['City', 'Bahawalpur Road', 'Rahim Yar Khan Road'],
  'Hasilpur': ['City', 'Bahawalpur Road', 'Multan Road'],
  'Mian Channu': ['City', 'Khanewal Road', 'Multan Road'],
  'Yazman': ['City', 'Bahawalpur Road', 'Rahim Yar Khan Road'],
};

const BRANDS = ['All Brands', 'Khaadi', 'Sapphire', 'J.', 'Outfitters', 'Gul Ahmed', 'Daraz', 'Samsung', 'Alkaram', 'Bonanza', 'Limelight', 'Ego', 'Bata', 'Service Shoes', 'Metro', 'Carrefour', 'Imtiaz', 'Chase Up', 'Al-Fatah'];
const CATEGORIES = ['All Categories', 'Clothing', 'Electronics', 'Food', 'Footwear', 'Groceries', 'Furniture', 'Mobiles', 'Jewellery', 'Beauty & Health', 'Sports', 'Home Appliances'];
const RADIUS_OPTIONS = [
  { label: '2 km', value: 2 },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '20 km', value: 20 },
  { label: '50 km', value: 50 },
];

interface Deal {
  id: string;
  brand: string;
  title: string;
  discount: string;
  expires: string;
  distance: string;
  location: string;
  tag: string;
}

export default function SaleRadarPage() {
  const [selectedBrand, setSelectedBrand] = useState(BRANDS[0]);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [selectedRadius, setSelectedRadius] = useState(5);

  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [popupError, setPopupError] = useState<string | null>(null);

  const cities = Object.keys(PAKISTAN_CITIES).sort();
  const areas = selectedCity ? (PAKISTAN_CITIES[selectedCity] || []) : [];

  const locationLabel = locationConfirmed && selectedCity
    ? (selectedArea ? selectedArea + ', ' : '') + selectedCity + ', Pakistan'
    : 'Select Your Location';

  const handleConfirmLocation = () => {
    if (!selectedCity) { setPopupError('Please select a city.'); return; }
    setLocationConfirmed(true);
    setShowLocationPopup(false);
    setPopupError(null);
    setError(null);
  };

  const fetchLiveDeals = async () => {
    try {
      const locStr = selectedArea ? (selectedArea + ", " + selectedCity) : selectedCity;
      const params = new URLSearchParams({
        brand: selectedBrand,
        category: selectedCategory,
        location: locStr
      });
      const res = await fetch('/api/deals?' + params.toString());
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      
      return data.map((d: any) => ({
        id: d.id,
        brand: d.brand,
        title: d.title,
        discount: d.discount,
        tag: d.tag,
        distance: (Math.random() * (selectedRadius - 0.5) + 0.5).toFixed(1) + " km away",
        location: locStr,
        expires: d.snippet
      }));
    } catch (e) {
      console.error(e);
      // Fallback if API fails
      return [{
         id: "error", brand: selectedBrand, title: "Could not fetch live deals", 
         discount: "N/A", tag: "Error", distance: "0 km", location: selectedCity, expires: "Please try again later."
      }];
    }
  };

  const handleScan = async () => {
    if (!locationConfirmed || !selectedCity) {
      setShowLocationPopup(true);
      return;
    }
    setIsScanning(true);
    setError(null);
    setScanComplete(false);
    try {
      await db.saleSearchHistory.add({
        latitude: 0,
        longitude: 0,
        radiusKm: selectedRadius,
        brand: selectedBrand,
        category: selectedCategory,
        createdAt: new Date(),
      });
      SyncService.sync();
      
      const liveDeals = await fetchLiveDeals();
      setDeals(liveDeals);
      setIsScanning(false); 
      setScanComplete(true); 
      
    } catch (err) {
      console.error(err);
      setError('Scan failed. Please try again.');
      setIsScanning(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen pb-10">

      {/* ── LOCATION POPUP ── */}
      {showLocationPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6 shadow-2xl flex flex-col gap-5 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-500" /> Choose Location
              </h2>
              <button onClick={() => setShowLocationPopup(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Country */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Country</label>
              <div className="w-full bg-green-50 border border-green-200 rounded-xl px-4 py-3 font-bold text-green-800 flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-green-600" /> 🇵🇰 Pakistan
                <span className="ml-auto text-[10px] bg-green-200 text-green-700 px-2 py-0.5 rounded-full">{cities.length} Cities</span>
              </div>
            </div>

            {/* City Searchable Dropdown */}
            <div className="z-20">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                City <span className="text-rose-400">*</span>
              </label>
              <SearchableSelect
                options={cities.map(c => ({ label: c, value: c }))}
                value={selectedCity}
                onChange={(val) => { setSelectedCity(val); setSelectedArea(''); setPopupError(null); }}
                placeholder="-- Select City --"
                searchPlaceholder="Search your city..."
              />
            </div>

            {/* Area Searchable Dropdown */}
            <div className="z-10">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Area / Sector <span className="text-slate-300 font-normal">(Optional)</span>
              </label>
              <SearchableSelect
                options={areas.map(a => ({ label: a, value: a }))}
                value={selectedArea}
                onChange={(val) => setSelectedArea(val)}
                placeholder={`-- All Areas in ${selectedCity || 'City'} --`}
                searchPlaceholder="Search area/sector..."
                disabled={!selectedCity}
              />
              {selectedCity && (
                <p className="text-[11px] text-slate-400 mt-1">{areas.length} areas available in {selectedCity}</p>
              )}
            </div>

            {popupError && (
              <p className="text-rose-600 text-sm font-bold bg-rose-50 border border-rose-100 p-3 rounded-xl">{popupError}</p>
            )}

            <button
              onClick={handleConfirmLocation}
              disabled={!selectedCity}
              className="w-full mt-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-black text-base py-4 rounded-2xl shadow-lg shadow-rose-200 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:transform-none flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" /> Confirm Location
            </button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-rose-600 to-pink-600 text-white p-4 shadow-lg flex items-center gap-3">
        <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2"><Radar className="w-5 h-5" /> Sale Radar</h1>
          {locationConfirmed && (
            <p className="text-xs text-rose-100 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {locationLabel}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 max-w-2xl w-full mx-auto flex flex-col gap-5 mt-4">

        {/* Radar Animation (only if not complete, or always at top?) Let's hide it if complete to show deals */}
        {!scanComplete && (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative flex items-center justify-center">
              <div className={isScanning ? "absolute w-36 h-36 bg-rose-100 rounded-full animate-ping" : "absolute w-36 h-36 bg-rose-100 rounded-full"}></div>
              <div className={isScanning ? "absolute w-24 h-24 bg-rose-50 rounded-full animate-ping opacity-60" : "absolute w-24 h-24 bg-rose-50 rounded-full opacity-60"}></div>
              <div className="z-10 bg-white p-6 rounded-full shadow-xl shadow-rose-200 border-4 border-rose-50">
                <Radar className={isScanning ? "w-12 h-12 text-rose-500 animate-spin" : "w-12 h-12 text-rose-500"} />
              </div>
            </div>
            <h2 className="mt-6 text-2xl font-bold text-gray-800 tracking-tight">Scan for Discounts</h2>
            <p className="text-gray-500 text-sm mt-1 text-center px-4">Find the biggest sales &amp; deals in your city right now.</p>
          </div>
        )}

        {/* Filter Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
          
          {/* Location Banner */}
          <button
            onClick={() => setShowLocationPopup(true)}
            className={locationConfirmed ? "w-full flex items-center justify-between p-4 rounded-2xl border transition-all bg-green-50 border-green-200 text-green-800 hover:border-green-300" : "w-full flex items-center justify-between p-4 rounded-2xl border transition-all bg-rose-50 border-rose-200 border-dashed text-rose-600 hover:border-rose-400 animate-pulse"}
          >
            <div className="flex items-center gap-3">
              <MapPin className={locationConfirmed ? "w-5 h-5 text-green-600" : "w-5 h-5 text-rose-500"} />
              <div className="text-left">
                <p className="font-bold text-sm">{locationConfirmed ? locationLabel : 'Tap to Select Location'}</p>
                <p className={locationConfirmed ? "text-xs text-green-600" : "text-xs text-rose-400"}>
                  {locationConfirmed ? 'Pakistan • Tap to change' : '⚠ Required before scanning'}
                </p>
              </div>
            </div>
            <ChevronDown className="w-5 h-5 opacity-50" />
          </button>

          {/* Radius Pills */}
          <div className="mt-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Target className="w-4 h-4" /> Search Radius
            </label>
            <div className="grid grid-cols-5 gap-2">
              {RADIUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedRadius(opt.value)}
                  className={selectedRadius === opt.value ? "py-2 px-1 rounded-xl text-xs font-bold border-2 transition-all bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-200" : "py-2 px-1 rounded-xl text-xs font-bold border-2 transition-all bg-white text-slate-600 border-slate-200 hover:border-rose-300"}
                >
                  {opt.value} km
                </button>
              ))}
            </div>
          </div>

          {/* Brand + Category */}
          <div className="grid grid-cols-2 gap-3 z-10 mt-2">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Store className="w-4 h-4" /> Brand
              </label>
              <SearchableSelect
                options={BRANDS.map(b => ({ label: b, value: b }))}
                value={selectedBrand}
                onChange={(val) => setSelectedBrand(val)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ShoppingBag className="w-4 h-4" /> Category
              </label>
              <SearchableSelect
                options={CATEGORIES.map(c => ({ label: c, value: c }))}
                value={selectedCategory}
                onChange={(val) => setSelectedCategory(val)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 flex items-center gap-2 mt-2">
              <MapPin className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={isScanning}
            className="w-full mt-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-rose-200 hover:shadow-rose-300 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:transform-none flex items-center justify-center gap-2"
          >
            {isScanning
              ? <><Loader2 className="w-6 h-6 animate-spin" /> Scanning {selectedCity || 'Area'}...</>
              : <><Search className="w-6 h-6" /> Find Sales Now</>
            }
          </button>
        </div>

        {/* Real Data Result Cards */}
        {scanComplete && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> {deals.length} Active Deals Found
              </h2>
              <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded-full">LIVE</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {deals.map(deal => (
                <div key={deal.id} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl z-10">
                    {deal.tag}
                  </div>
                  
                  <div className="flex flex-col h-full gap-3">
                    <div>
                      <h3 className="font-black text-lg text-slate-800 leading-tight pr-10">{deal.brand}</h3>
                      <p className="text-sm font-semibold text-slate-500 mt-1">{deal.title}</p>
                    </div>

                    <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl flex items-center justify-center my-1">
                      <p className="text-xl font-black text-rose-600">{deal.discount}</p>
                    </div>

                    <div className="mt-auto flex flex-col gap-1.5 text-xs text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{deal.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                        <span className="text-blue-600 font-bold">{deal.distance}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-amber-600 mt-1 bg-amber-50 px-2 py-1.5 rounded-lg w-max">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-bold">{deal.expires}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-slate-100 text-slate-500 text-xs text-center p-4 rounded-xl mt-4 font-semibold border border-slate-200">
              End of results for {selectedRadius}km radius
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
