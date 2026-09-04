'use client';
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ServiceType, ServiceSubscription, DeliveryLog, KhataCustomer } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import { SyncService } from '@/services/SyncService';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Trash2,
  MessageCircle,
  Layers,
  Users,
  Receipt,
  Share2,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { label: 'Itwar (Sun)', value: 0 },
  { label: 'Peer (Mon)', value: 1 },
  { label: 'Mangal (Tue)', value: 2 },
  { label: 'Budh (Wed)', value: 3 },
  { label: 'Jumerat (Thu)', value: 4 },
  { label: 'Juma (Fri)', value: 5 },
  { label: 'Hafta (Sat)', value: 6 }
];

export default function ServicesPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'daily' | 'setup' | 'billing'>('daily');
  
  // Daily tab states
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [filterServiceTypeId, setFilterServiceTypeId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [syncing, setSyncing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Billing tab states
  const currentMonthStr = todayStr.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [postingKhataSubId, setPostingKhataSubId] = useState<string | null>(null);

  // Setup modal states
  const [showTypeModal, setShowTypeModal] = useState<boolean>(false);
  const [typeName, setTypeName] = useState('');
  const [typeUnit, setTypeUnit] = useState('litre');
  const [typeDefaultRate, setTypeDefaultRate] = useState<number>(200);

  const [showSubModal, setShowSubModal] = useState<boolean>(false);
  const [subCustomerId, setSubCustomerId] = useState('');
  const [subServiceTypeId, setSubServiceTypeId] = useState('');
  const [subAgreedRate, setSubAgreedRate] = useState<number>(200);
  const [subDefaultQty, setSubDefaultQty] = useState<number>(1);
  const [subFrequency, setSubFrequency] = useState<'daily' | 'alternate_days' | 'custom'>('daily');
  const [subCustomDays, setSubCustomDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [subStartDate, setSubStartDate] = useState(todayStr);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Dexie live queries (offline-first source of truth for UI)
  const serviceTypes = useLiveQuery(
    () => db.serviceTypes.filter(st => !st.isDeleted).toArray(),
    []
  ) ?? [];

  const subscriptions = useLiveQuery(
    () => db.serviceSubscriptions.filter(s => !s.isDeleted).toArray(),
    []
  ) ?? [];

  const deliveryLogs = useLiveQuery(
    () => db.deliveryLogs.filter(dl => !dl.isDeleted).toArray(),
    []
  ) ?? [];

  const khataCustomers = useLiveQuery(
    () => db.khataCustomers.filter(c => !c.isDeleted).toArray(),
    []
  ) ?? [];

  // Mappings for fast O(1) lookups
  const customerMap = useMemo(() => {
    const map = new Map<string, KhataCustomer>();
    for (const c of khataCustomers) {
      if (c.syncId) map.set(c.syncId, c);
    }
    return map;
  }, [khataCustomers]);

  const serviceTypeMap = useMemo(() => {
    const map = new Map<string, ServiceType>();
    for (const st of serviceTypes) {
      if (st.syncId) map.set(st.syncId, st);
    }
    return map;
  }, [serviceTypes]);

  // Delivery log map: key = `${subscriptionId}_${date}`
  const logMap = useMemo(() => {
    const map = new Map<string, DeliveryLog>();
    for (const dl of deliveryLogs) {
      map.set(`${dl.subscriptionId}_${dl.date}`, dl);
    }
    return map;
  }, [deliveryLogs]);

  // Handle previous/next day
  const shiftDay = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  // Mark Delivery Handler (Offline first + Auto Sync)
  const handleMarkDelivery = async (
    subscription: ServiceSubscription,
    status: 'received' | 'not_received' | 'skipped',
    quantity?: number
  ) => {
    if (!subscription.syncId) return;

    const existingLog = logMap.get(`${subscription.syncId}_${selectedDate}`);
    const now = new Date();
    const isStaff = user?.role === 'CASHIER' || user?.role === 'MANAGER';
    const markedBy: 'owner' | 'staff' = isStaff ? 'staff' : 'owner';
    const qty = quantity !== undefined ? quantity : (existingLog?.quantity || subscription.defaultQuantity || 1);

    if (existingLog && existingLog.id) {
      await db.deliveryLogs.update(existingLog.id, {
        status,
        quantity: qty,
        markedBy,
        markedByUserId: String(user?.id || ''),
        source: 'app',
        updatedAt: now
      });
    } else {
      const verificationToken = crypto.randomUUID();
      await db.deliveryLogs.add({
        syncId: crypto.randomUUID(),
        companyCode: user?.companyCode,
        subscriptionId: subscription.syncId,
        date: selectedDate,
        status,
        quantity: qty,
        markedBy,
        markedByUserId: String(user?.id || ''),
        source: 'app',
        verificationToken,
        createdAt: now,
        updatedAt: now,
        isDeleted: false
      });
    }

    showToast(`Status updated: ${status === 'received' ? 'Pohnch Gaya (Received)' : status === 'not_received' ? 'Nahi Mila' : 'Skipped'}`);
    
    // Background sync trigger
    SyncService.sync().catch(console.error);
  };

  // Generate 2-Way WhatsApp link for customer
  const handleShareWhatsAppLink = (subscription: ServiceSubscription) => {
    const customer = customerMap.get(subscription.customerId);
    const service = serviceTypeMap.get(subscription.serviceTypeId);
    const log = logMap.get(`${subscription.syncId}_${selectedDate}`);

    if (!customer?.phone) {
      alert('Grahak ka WhatsApp / Phone number moojood nahi hai.');
      return;
    }

    const token = log?.verificationToken || crypto.randomUUID();
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
    const proto = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    const confirmUrl = `${proto}//${host}/confirm-service/${token}`;

    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.startsWith('0') ? `92${cleanPhone.slice(1)}` : cleanPhone;

    const message = `Assalam-o-Alaikum ${customer.name}, aaj (${selectedDate}) ki ${service?.name || 'Service'} (${log?.quantity || subscription.defaultQuantity || 1} ${service?.unit || ''}) delivery mark ho gayi hai.\n\nTasdeeq (Confirm) karne ke liye is link par click karein:\n${confirmUrl}`;

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Add Service Type
  const handleCreateServiceType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeName.trim()) return;

    await db.serviceTypes.add({
      syncId: crypto.randomUUID(),
      companyCode: user?.companyCode,
      name: typeName.trim(),
      unit: typeUnit,
      defaultRate: Number(typeDefaultRate) || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    });

    setTypeName('');
    setTypeDefaultRate(200);
    setShowTypeModal(false);
    showToast('Nayi service kamyabi se shamil ho gayi!');
    SyncService.sync().catch(console.error);
  };

  // Add Subscription
  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCustomerId || !subServiceTypeId) {
      alert('Grahak aur Service Type select karna lazmi hai.');
      return;
    }

    await db.serviceSubscriptions.add({
      syncId: crypto.randomUUID(),
      companyCode: user?.companyCode,
      customerId: subCustomerId,
      serviceTypeId: subServiceTypeId,
      startDate: subStartDate,
      frequency: subFrequency,
      customDays: subFrequency === 'custom' ? subCustomDays : undefined,
      agreedRate: Number(subAgreedRate) || 0,
      defaultQuantity: Number(subDefaultQty) || 1,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    });

    setShowSubModal(false);
    setSubCustomerId('');
    setSubServiceTypeId('');
    showToast('Grahak ki subscription shamil kar li gayi!');
    SyncService.sync().catch(console.error);
  };

  // Soft Delete Subscription
  const handleDeleteSubscription = async (sub: ServiceSubscription) => {
    if (!confirm('Kiya aap waqai is subscription ko khatam karna chahte hain?')) return;
    if (sub.id) {
      await db.serviceSubscriptions.update(sub.id, {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      });
      showToast('Subscription archive ho gayi.');
      SyncService.sync().catch(console.error);
    }
  };

  // Post Derived Monthly Bill into Customer Khata
  const handlePostToKhata = async (sub: ServiceSubscription, computedBill: number, receivedDays: number) => {
    if (!sub.customerId || !sub.syncId) return;
    if (computedBill <= 0) {
      alert('Is mahinay mein koi delivered hazri nahi hai, bill Rs 0 hai.');
      return;
    }

    const customer = customerMap.get(sub.customerId);
    const service = serviceTypeMap.get(sub.serviceTypeId);
    const note = `Rozana Service: ${service?.name || 'Service'} (${selectedMonth} Mahana Bill) - ${receivedDays} din`;

    if (!confirm(`Kiya aap ${customer?.name} ke Khata mein Rs ${computedBill.toLocaleString()} ka bill darj karna chahte hain?`)) {
      return;
    }

    setPostingKhataSubId(sub.syncId);
    try {
      await db.khataTransactions.add({
        syncId: crypto.randomUUID(),
        companyCode: user?.companyCode,
        customerId: sub.customerId,
        type: 'CREDIT', // Receivable udhaar in Khata
        amount: computedBill,
        note,
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false
      });

      showToast(`Rs ${computedBill.toLocaleString()} ${customer?.name} ke Khata mein darj ho gaye!`);
      SyncService.sync().catch(console.error);
    } catch (err) {
      console.error(err);
      alert('Khata mein entry darj karne mein masla pesh aya.');
    } finally {
      setPostingKhataSubId(null);
    }
  };

  // Filtered active subscriptions for daily tab
  const activeSubscriptions = useMemo(() => {
    return subscriptions.filter(sub => {
      if (sub.status !== 'active') return false;
      if (filterServiceTypeId !== 'all' && sub.serviceTypeId !== filterServiceTypeId) return false;
      if (searchQuery.trim()) {
        const c = customerMap.get(sub.customerId);
        const s = serviceTypeMap.get(sub.serviceTypeId);
        const q = searchQuery.toLowerCase();
        const matchesName = c?.name?.toLowerCase().includes(q);
        const matchesPhone = c?.phone?.includes(q);
        const matchesService = s?.name?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesService) return false;
      }
      return true;
    });
  }, [subscriptions, filterServiceTypeId, searchQuery, customerMap, serviceTypeMap]);

  // Today's summary stats
  const todayStats = useMemo(() => {
    let markedCount = 0;
    let receivedCount = 0;
    let notReceivedCount = 0;

    for (const sub of subscriptions.filter(s => s.status === 'active')) {
      const log = logMap.get(`${sub.syncId}_${selectedDate}`);
      if (log) {
        markedCount++;
        if (log.status === 'received') receivedCount++;
        if (log.status === 'not_received') notReceivedCount++;
      }
    }

    const totalActive = subscriptions.filter(s => s.status === 'active').length;
    return {
      totalActive,
      markedCount,
      pendingCount: Math.max(0, totalActive - markedCount),
      receivedCount,
      notReceivedCount
    };
  }, [subscriptions, logMap, selectedDate]);

  // Monthly billing calculations (derived on the fly)
  const monthlyBillingData = useMemo(() => {
    return subscriptions.map(sub => {
      const customer = customerMap.get(sub.customerId);
      const service = serviceTypeMap.get(sub.serviceTypeId);
      
      // Filter logs for this subscription in selectedMonth
      const monthLogs = deliveryLogs.filter(
        dl => dl.subscriptionId === sub.syncId && dl.date.startsWith(selectedMonth)
      );

      let receivedDays = 0;
      let notReceivedDays = 0;
      let skippedDays = 0;
      let totalDeliveredUnits = 0;

      // Map by day of month (1..31)
      const dayStatusMap = new Map<number, 'received' | 'not_received' | 'skipped'>();

      for (const log of monthLogs) {
        const dayNum = parseInt(log.date.slice(8, 10), 10);
        dayStatusMap.set(dayNum, log.status);

        if (log.status === 'received') {
          receivedDays++;
          const q = log.quantity !== undefined && log.quantity !== null ? Number(log.quantity) : (sub.defaultQuantity || 1);
          totalDeliveredUnits += q;
        } else if (log.status === 'not_received') {
          notReceivedDays++;
        } else if (log.status === 'skipped') {
          skippedDays++;
        }
      }

      const totalBill = Math.round(totalDeliveredUnits * sub.agreedRate);

      return {
        sub,
        customer,
        service,
        receivedDays,
        notReceivedDays,
        skippedDays,
        totalDeliveredUnits,
        totalBill,
        dayStatusMap
      };
    });
  }, [subscriptions, deliveryLogs, selectedMonth, customerMap, serviceTypeMap]);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold border border-slate-700 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-indigo-200 mb-3 border border-white/10">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Rozana Periodic Service Engine
            </div>
            <h1 className="text-3xl font-black tracking-tight">Rozana Service Tracker</h1>
            <p className="text-indigo-200 text-sm mt-1 max-w-xl">
              Doodh, Kachra, Pani Tanker, Akhbar ya koi bhi periodic delivery track karein. Grahak ke sath 2-Way WhatsApp verification aur Khata integration.
            </p>
          </div>

          {/* Quick Stats Bar */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex flex-col">
              <span className="text-[11px] font-bold text-indigo-200 uppercase">Active Subscriptions</span>
              <span className="text-2xl font-black text-white mt-0.5">{todayStats.totalActive}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex flex-col">
              <span className="text-[11px] font-bold text-indigo-200 uppercase">Aaj Marked</span>
              <span className="text-2xl font-black text-emerald-300 mt-0.5">{todayStats.markedCount} / {todayStats.totalActive}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-8 border-b border-indigo-700/50 pb-0">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-5 py-3 rounded-t-2xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-white text-indigo-900 shadow-md'
                : 'text-indigo-200 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="w-4 h-4" /> Rozana Hazri (Daily Marking)
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`px-5 py-3 rounded-t-2xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'billing'
                ? 'bg-white text-indigo-900 shadow-md'
                : 'text-indigo-200 hover:text-white hover:bg-white/5'
            }`}
          >
            <Receipt className="w-4 h-4" /> Mahana Bill & Hazri Sheet
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`px-5 py-3 rounded-t-2xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'setup'
                ? 'bg-white text-indigo-900 shadow-md'
                : 'text-indigo-200 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4" /> Services & Grahak Setup
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY MARKING SCREEN                                                */}
      {/* ========================================================================= */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Date & Filter Toolbar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Date Picker with Prev / Next day buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => shiftDay(-1)}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Pichla Din"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 text-sm focus:outline-none cursor-pointer"
                />
              </div>
              <button
                onClick={() => shiftDay(1)}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Agla Din"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {selectedDate !== todayStr && (
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Aaj (Today)
                </button>
              )}
            </div>

            {/* Service Filter & Search */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={filterServiceTypeId}
                onChange={(e) => setFilterServiceTypeId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Tamam Services ({serviceTypes.length})</option>
                {serviceTypes.map(st => (
                  <option key={st.syncId} value={st.syncId}>{st.name} ({st.unit})</option>
                ))}
              </select>

              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Grahak ya service talash karein..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Subscriptions Delivery Grid */}
          {activeSubscriptions.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Koi Active Subscription Nahi Mili</h3>
              <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                "Services & Grahak Setup" tab mein ja kar pehle services aur grahakon ko subscribe karein.
              </p>
              <button
                onClick={() => setActiveTab('setup')}
                className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Abhi Setup Karein
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSubscriptions.map((sub) => {
                const customer = customerMap.get(sub.customerId);
                const service = serviceTypeMap.get(sub.serviceTypeId);
                const log = logMap.get(`${sub.syncId}_${selectedDate}`);
                const isReceived = log?.status === 'received';
                const isNotReceived = log?.status === 'not_received';
                const isSkipped = log?.status === 'skipped';
                const isMarked = !!log;

                return (
                  <div
                    key={sub.syncId}
                    className={`bg-white rounded-3xl p-5 shadow-sm border transition-all flex flex-col justify-between ${
                      isReceived
                        ? 'border-emerald-300 bg-emerald-50/20'
                        : isNotReceived
                        ? 'border-rose-300 bg-rose-50/20'
                        : isSkipped
                        ? 'border-amber-300 bg-amber-50/20'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Customer & Service Info */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">
                            {customer?.name || 'Grahak'}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">{customer?.phone || 'No phone'}</p>
                        </div>
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black border border-indigo-100">
                          {service?.name || 'Service'}
                        </span>
                      </div>

                      {/* Agreed Rate & Default Qty */}
                      <div className="bg-slate-50 rounded-2xl p-3 mb-4 flex items-center justify-between text-xs text-slate-600">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Default Qty</span>
                          <span className="font-black text-slate-800">
                            {sub.defaultQuantity || 1} {service?.unit || 'Unit'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Agreed Rate</span>
                          <span className="font-black text-slate-800">
                            Rs {sub.agreedRate} / {service?.unit || 'unit'}
                          </span>
                        </div>
                      </div>

                      {/* Status / Audit Indicator */}
                      {isMarked ? (
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-500">Hazri Record:</span>
                            {isReceived && (
                              <span className="text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px] font-bold">
                                <Check className="w-3 h-3" /> Pohnch Gaya (Received)
                              </span>
                            )}
                            {isNotReceived && (
                              <span className="text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px] font-bold">
                                <XCircle className="w-3 h-3" /> Nahi Mila (Dispute)
                              </span>
                            )}
                            {isSkipped && (
                              <span className="text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px] font-bold">
                                <Clock className="w-3 h-3" /> Skipped / Chutti
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-1">
                            {log.markedBy === 'customer'
                              ? '✓ Customer ne WhatsApp link se tasdeeq ki'
                              : log.markedBy === 'staff'
                              ? 'Marked by Staff (Cashier/Counter)'
                              : 'Marked by Dukan Malik (Owner)'}
                          </span>
                        </div>
                      ) : (
                        <div className="mb-4 text-xs font-semibold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-500" /> Aaj ki hazri abhi baqi hai
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => handleMarkDelivery(sub, 'received')}
                          className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                            isReceived
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mila
                        </button>

                        <button
                          onClick={() => handleMarkDelivery(sub, 'not_received')}
                          className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                            isNotReceived
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Nahi Mila
                        </button>

                        <button
                          onClick={() => handleMarkDelivery(sub, 'skipped')}
                          className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                            isSkipped
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" /> Skip
                        </button>
                      </div>

                      {/* WhatsApp 2-Way Link Button */}
                      <button
                        onClick={() => handleShareWhatsAppLink(sub)}
                        className="w-full py-2 px-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Customer ko WhatsApp verification link bhaijein"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        WhatsApp 2-Way Tick Link
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SETUP (SERVICES & SUBSCRIPTIONS)                                   */}
      {/* ========================================================================= */}
      {activeTab === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section 1: Service Types (Left Column) */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Service Types</h3>
                <p className="text-xs text-slate-500">Doodh, Kachra, Pani, Akhbar, etc.</p>
              </div>
              <button
                onClick={() => setShowTypeModal(true)}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-sm transition-colors cursor-pointer"
                title="Nayi Service Add Karein"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {serviceTypes.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Koi service type nahi bani hui. Upar '+' button se nayi service banayein.
              </div>
            ) : (
              <div className="space-y-3">
                {serviceTypes.map(st => (
                  <div
                    key={st.syncId}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{st.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Default Rate: <span className="font-semibold text-slate-800">Rs {st.defaultRate}</span> / {st.unit}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm(`Kiya aap '${st.name}' service delete karna chahte hain?`)) {
                          if (st.id) await db.serviceTypes.update(st.id, { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() });
                          SyncService.sync().catch(console.error);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Active Subscriptions List (Right Columns) */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Grahak Subscriptions</h3>
                <p className="text-xs text-slate-500">Khata customers ko service se link karein</p>
              </div>
              <button
                onClick={() => setShowSubModal(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Naya Grahak Subscribe Karein
              </button>
            </div>

            {subscriptions.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Koi grahak subscribe nahi hai. Naya grahak subscribe karne ke liye upar button dabayein.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-3 px-3">Grahak (Customer)</th>
                      <th className="py-3 px-3">Service</th>
                      <th className="py-3 px-3">Frequency</th>
                      <th className="py-3 px-3">Agreed Rate</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {subscriptions.map(sub => {
                      const customer = customerMap.get(sub.customerId);
                      const service = serviceTypeMap.get(sub.serviceTypeId);

                      return (
                        <tr key={sub.syncId} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-bold text-slate-900">
                            {customer?.name || 'Grahak'}
                            <span className="block text-[10px] text-slate-400 font-normal">{customer?.phone}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold">
                              {service?.name || 'Service'}
                            </span>
                          </td>
                          <td className="py-3 px-3 capitalize">{sub.frequency}</td>
                          <td className="py-3 px-3 font-bold">
                            Rs {sub.agreedRate} <span className="text-[10px] text-slate-400 font-normal">({sub.defaultQuantity || 1} {service?.unit})</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleDeleteSubscription(sub)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete subscription"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MONTHLY DERIVED BILLING & ATTENDANCE SHEET                          */}
      {/* ========================================================================= */}
      {activeTab === 'billing' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
          {/* Month Selector & Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-xl font-black text-slate-900">Mahana Hazri Sheet & Bill Calculation</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sirf pohnchaye gaye dinon (actual delivered days) ki bunyad par derived bill calculate hota hai.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Derived Attendance Matrix & Billing Rows */}
          {monthlyBillingData.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Is mahinay ke liye koi active subscriptions nahi hain.
            </div>
          ) : (
            <div className="space-y-4">
              {monthlyBillingData.map(({ sub, customer, service, receivedDays, notReceivedDays, skippedDays, totalDeliveredUnits, totalBill, dayStatusMap }) => {
                return (
                  <div
                    key={sub.syncId}
                    className="border border-slate-200/80 rounded-2xl p-5 hover:border-indigo-200 transition-all space-y-4"
                  >
                    {/* Top Row: Info & Totals */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base">{customer?.name || 'Grahak'}</h4>
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold">
                            {service?.name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Agreed Rate: Rs {sub.agreedRate} / {service?.unit} • Delivered Days: <span className="font-bold text-emerald-600">{receivedDays} din</span>
                        </p>
                      </div>

                      {/* Bill Calculation Badge & Post to Khata Button */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Computed Bill</span>
                          <span className="text-2xl font-black text-indigo-900">
                            Rs {totalBill.toLocaleString()}
                          </span>
                        </div>

                        <button
                          onClick={() => handlePostToKhata(sub, totalBill, receivedDays)}
                          disabled={postingKhataSubId === sub.syncId || totalBill <= 0}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Receipt className="w-4 h-4" />
                          Post to Khata
                        </button>
                      </div>
                    </div>

                    {/* 1..31 Days Attendance Matrix */}
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
                        {selectedMonth} Hazri Calendar (1–31 Din)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                          const status = dayStatusMap.get(day);
                          return (
                            <div
                              key={day}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${
                                status === 'received'
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : status === 'not_received'
                                  ? 'bg-rose-500 text-white'
                                  : status === 'skipped'
                                  ? 'bg-amber-400 text-slate-900'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                              title={`Day ${day}: ${status || 'No record'}`}
                            >
                              {day}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Received ({receivedDays})
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Not Received ({notReceivedDays})
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> Skipped ({skippedDays})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD SERVICE TYPE                                                 */}
      {/* ========================================================================= */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Nayi Service Banayein</h3>
            <p className="text-xs text-slate-500 mb-4">Doodh, Kachra, Pani Tanker, Akhbar waghera define karein.</p>

            <form onSubmit={handleCreateServiceType} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Service Ka Naam</label>
                <input
                  type="text"
                  placeholder="e.g. Khalsa Doodh, Daily Kachra, Pani Tanker"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Unit (Paimanna)</label>
                <select
                  value={typeUnit}
                  onChange={(e) => setTypeUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="litre">Litre (Doodh waghera)</option>
                  <option value="trip">Trip / Phera (Tanker, Gari)</option>
                  <option value="fixed">Fixed / Monthly (Kachra, Akhbar)</option>
                  <option value="custom">Custom Unit</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Default Rate (Rs per Unit)</label>
                <input
                  type="number"
                  value={typeDefaultRate}
                  onChange={(e) => setTypeDefaultRate(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD SUBSCRIPTION                                                 */}
      {/* ========================================================================= */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Grahak Ko Subscribe Karein</h3>
            <p className="text-xs text-slate-500 mb-4">Digital Khata ke grahak ko periodic service ke sath jorain.</p>

            <form onSubmit={handleCreateSubscription} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Khata Grahak (Customer)</label>
                <select
                  value={subCustomerId}
                  onChange={(e) => setSubCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  required
                >
                  <option value="">Grahak Select Karein...</option>
                  {khataCustomers.map(c => (
                    <option key={c.syncId} value={c.syncId}>{c.name} ({c.phone || 'No phone'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Service Type</label>
                <select
                  value={subServiceTypeId}
                  onChange={(e) => {
                    setSubServiceTypeId(e.target.value);
                    const selected = serviceTypeMap.get(e.target.value);
                    if (selected) setSubAgreedRate(selected.defaultRate);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  required
                >
                  <option value="">Service Select Karein...</option>
                  {serviceTypes.map(st => (
                    <option key={st.syncId} value={st.syncId}>{st.name} ({st.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Agreed Rate (Rs)</label>
                  <input
                    type="number"
                    value={subAgreedRate}
                    onChange={(e) => setSubAgreedRate(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Default Daily Qty</label>
                  <input
                    type="number"
                    step="0.1"
                    value={subDefaultQty}
                    onChange={(e) => setSubDefaultQty(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Frequency</label>
                  <select
                    value={subFrequency}
                    onChange={(e) => setSubFrequency(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="daily">Rozana (Daily)</option>
                    <option value="alternate_days">Aik Din Chhor Kar (Alternate)</option>
                    <option value="custom">Haftay Ke Makhsoos Din</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={subStartDate}
                    onChange={(e) => setSubStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
