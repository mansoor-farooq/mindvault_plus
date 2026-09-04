'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { 
  Check, Sparkles, Zap, Crown, ArrowRight, Loader2, CreditCard, 
  ShieldCheck, Lock, Smartphone, Building2, CheckCircle2, X, Star, 
  ChevronRight, BadgePercent, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface PlanDetails {
  key: string;
  name: string;
  tier: string;
  badge?: string;
  priceUsd: number;
  pricePkr: number;
  billingText: string;
  color: 'emerald' | 'indigo' | 'violet' | 'amber';
  features: string[];
}

export default function UpgradePage() {
  const router = useRouter();
  const { user, token, setFeatureAccess } = useAuthStore();
  
  // Checkout Modal State
  const [selectedPlan, setSelectedPlan] = useState<PlanDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'EASYPAISA' | 'JAZZCASH' | 'CARD' | 'RAAST'>('EASYPAISA');
  
  // Dummy Form Inputs
  const [mobileNumber, setMobileNumber] = useState('0301-2345678');
  const [accountTitle, setAccountTitle] = useState('Mansoor Business');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('888');

  // Interactive Payment Flow
  const [paymentStep, setPaymentStep] = useState<'FORM' | 'PROCESSING' | 'SUCCESS'>('FORM');
  const [processingStatus, setProcessingStatus] = useState('Initializing secure demo gateway...');
  const [transactionId, setTransactionId] = useState('');

  const openCheckout = (plan: PlanDetails) => {
    setSelectedPlan(plan);
    setPaymentStep('FORM');
  };

  const closeCheckout = () => {
    if (paymentStep === 'PROCESSING') return;
    setSelectedPlan(null);
    setPaymentStep('FORM');
  };

  const autoFillDemo = () => {
    if (paymentMethod === 'EASYPAISA' || paymentMethod === 'JAZZCASH') {
      setMobileNumber('0302-8877665');
      setAccountTitle('Pak Demo Enterprise');
    } else if (paymentMethod === 'CARD') {
      setCardNumber('4000 1234 5678 9010');
      setCardExpiry('08/29');
      setCardCvc('321');
      setAccountTitle('Demo Cardholder');
    } else {
      setAccountTitle('Meezan Bank Ltd (Demo)');
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedPlan) return;
    setPaymentStep('PROCESSING');

    const txn = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
    setTransactionId(txn);

    try {
      // Step 1: Connecting
      setProcessingStatus(`Connecting to ${paymentMethod} sandbox payment switch...`);
      await new Promise(r => setTimeout(r, 700));

      // Step 2: Authorizing
      setProcessingStatus(`Authorizing demo payment of Rs ${selectedPlan.pricePkr.toLocaleString()}...`);
      await new Promise(r => setTimeout(r, 800));

      // Step 3: Upgrading Server DB
      setProcessingStatus('Provisioning VIP tenant license & permissions...');
      
      try {
        if (token) {
          await fetch('/api/user/upgrade', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ plan: selectedPlan.key })
          });
        }
      } catch (e) {
        console.warn('Silent fallback in demo mode:', e);
      }

      await new Promise(r => setTimeout(r, 600));

      // Transition to Success Celebration
      setPaymentStep('SUCCESS');
    } catch {
      setPaymentStep('SUCCESS');
    }
  };

  const isFree = !user?.license || user.license === 'FREE';

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 text-slate-800">
      
      {/* Top Breadcrumb & Header */}
      <div className="max-w-5xl w-full flex items-center justify-between mb-8">
        <Link 
          href="/" 
          className="p-2.5 bg-white rounded-2xl border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" /> Official VIP Licensing
        </span>
      </div>

      <div className="max-w-4xl w-full text-center mb-10">
        <div className="inline-flex p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm mb-4">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Supercharge your Business
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
          {isFree 
            ? "Upgrade to unlock full POS Countertop, Customer Khata WhatsApp reminders, Factory Manufacturing, and Multi-Branch analytics." 
            : "Manage your premium subscription and enjoy uninterrupted access to all executive ERP modules."}
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl w-full mx-auto items-stretch">
        
        {/* FREE PLAN */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Basic Starter</span>
            <h3 className="text-xl font-bold text-slate-900 mt-3 mb-1">Free Trial</h3>
            <p className="text-slate-500 mb-4 text-xs">Essential sandbox for new shops.</p>
            <div className="text-3xl font-black text-slate-900 mb-6">$0<span className="text-sm text-slate-400 font-medium">/mo</span></div>
            <ul className="space-y-3 mb-6 text-xs">
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-slate-400 shrink-0"/> <span className="text-slate-600">POS & Inventory (50 items)</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-slate-400 shrink-0"/> <span className="text-slate-600">Khata Customers (25)</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-slate-400 shrink-0"/> <span className="text-slate-600">Single Device Offline Billing</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-slate-400 shrink-0"/> <span className="text-slate-600">Standard Calculator</span></li>
            </ul>
          </div>
          <button disabled className="w-full py-3 px-4 rounded-2xl font-bold bg-slate-100 text-slate-400 text-xs cursor-default">
            {isFree ? 'Current Plan' : 'Basic Tier'}
          </button>
        </div>

        {/* STARTER PLAN */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-emerald-500/80 flex flex-col justify-between relative">
          <div className="absolute top-0 right-5 transform -translate-y-1/2">
            <span className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider py-1 px-3 rounded-full shadow-sm">Dukan Favorite</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">Retail Store</span>
            <h3 className="text-xl font-bold text-slate-900 mt-3 mb-1">Starter</h3>
            <p className="text-slate-500 mb-4 text-xs">For solo kiryana, footwear & retail shops.</p>
            <div className="text-3xl font-black text-slate-900 mb-1">$6<span className="text-sm text-slate-500 font-medium">/mo</span></div>
            <p className="text-xs text-emerald-600 font-bold mb-6">~Rs 1,680 PKR / month</p>
            <ul className="space-y-3 mb-6 text-xs">
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0"/> <span className="text-slate-700 font-bold">Khata Customers (500)</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0"/> <span className="text-slate-700 font-bold">Products Stock (1,000)</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0"/> <span className="text-slate-700 font-bold">1-Click WhatsApp Reminders</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0"/> <span className="text-slate-600">Roznamcha & Cash Register</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0"/> <span className="text-slate-600">Estimates & Quotes Builder</span></li>
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => openCheckout({
                key: 'STARTER',
                name: 'Starter Plan (Monthly)',
                tier: 'STARTER',
                badge: 'Dukan Favorite',
                priceUsd: 6,
                pricePkr: 1680,
                billingText: 'Billed monthly',
                color: 'emerald',
                features: ['500 Khata Customers', '1,000 Inventory Products', '1-Click WhatsApp Reminders', 'Roznamcha & Wallets']
              })}
              className="w-full py-3 px-3 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center gap-1.5 text-xs shadow-sm"
            >
              <CreditCard className="w-3.5 h-3.5" /> Monthly ($6)
            </button>
            <button 
              onClick={() => openCheckout({
                key: 'STARTER_ANNUAL',
                name: 'Starter Plan (1 Year)',
                tier: 'STARTER',
                badge: 'Save 18%',
                priceUsd: 59,
                pricePkr: 16500,
                billingText: 'Billed annually ($59/yr)',
                color: 'emerald',
                features: ['500 Khata Customers', '1,000 Inventory Products', '1-Click WhatsApp Reminders', 'Roznamcha & Wallets', '18% Annual Discount']
              })}
              className="w-full py-2.5 px-3 rounded-2xl font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1 text-xs"
            >
              1 Year ($59 — Save 18%)
            </button>
          </div>
        </div>

        {/* PRO PLAN */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">Multi-Staff</span>
            <h3 className="text-xl font-bold text-slate-900 mt-3 mb-1">PRO Business</h3>
            <p className="text-slate-500 mb-4 text-xs">For multi-staff & wholesale stores.</p>
            <div className="text-3xl font-black text-slate-900 mb-1">$15<span className="text-sm text-slate-500 font-medium">/mo</span></div>
            <p className="text-xs text-indigo-600 font-bold mb-6">~Rs 4,200 PKR / month</p>
            <ul className="space-y-3 mb-6 text-xs">
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-indigo-600 shrink-0"/> <span className="text-slate-700 font-bold">5,000 Khata & 10,000 Products</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-indigo-600 shrink-0"/> <span className="text-slate-700 font-bold">Cashier vs Owner Security Gate</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-indigo-600 shrink-0"/> <span className="text-slate-700">Staff Attendance & Advances</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-indigo-600 shrink-0"/> <span className="text-slate-700">Factory Production (Single BOM)</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-indigo-600 shrink-0"/> <span className="text-slate-700">Vendors & Purchase Orders</span></li>
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => openCheckout({
                key: 'PRO',
                name: 'PRO Business (Monthly)',
                tier: 'PRO',
                badge: 'Wholesale & Staff',
                priceUsd: 15,
                pricePkr: 4200,
                billingText: 'Billed monthly',
                color: 'indigo',
                features: ['5,000 Customers & 10,000 Products', 'Cashier vs Owner Role Gate', 'Staff Attendance & Peshgi', 'Single-Level Factory BOM']
              })}
              className="w-full py-3 px-3 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center justify-center gap-1.5 text-xs shadow-sm"
            >
              <CreditCard className="w-3.5 h-3.5" /> Monthly ($15)
            </button>
            <button 
              onClick={() => openCheckout({
                key: 'PRO_ANNUAL',
                name: 'PRO Business (1 Year)',
                tier: 'PRO',
                priceUsd: 139,
                pricePkr: 38900,
                billingText: 'Billed annually ($139/yr)',
                color: 'indigo',
                features: ['5,000 Customers & 10,000 Products', 'Cashier vs Owner Role Gate', 'Staff Attendance & Peshgi', 'Annual Priority Support']
              })}
              className="w-full py-2.5 px-3 rounded-2xl font-bold bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1 text-xs"
            >
              1 Year ($139)
            </button>
          </div>
        </div>

        {/* ULTRA & LIFETIME PLAN */}
        <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border-2 border-amber-500/50 flex flex-col justify-between text-white relative">
          <div className="absolute top-0 right-5 transform -translate-y-1/2">
            <span className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-[10px] font-black uppercase tracking-wider py-1 px-3 rounded-full shadow-md">
              Founder Club
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-amber-400 mb-1">
              <Crown className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-wider">Ultimate VIP</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Lifetime VIP</h3>
            <p className="text-slate-400 mb-4 text-xs">Pay once, own all features forever.</p>
            <div className="mb-2">
              <span className="text-xs text-slate-400 line-through">Regular: $449</span>
              <div className="text-3xl font-black text-amber-400">$299<span className="text-sm text-slate-300 font-medium">/once</span></div>
              <p className="text-xs text-amber-300/90 font-bold mt-1">~Rs 83,000 PKR one-time fee</p>
            </div>
            <ul className="space-y-3 mb-6 text-xs text-slate-300">
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0"/> <span className="text-white font-bold">Unlimited Customers & Products</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0"/> <span className="text-white font-bold">Unlimited Factory BOM & Routing</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0"/> <span>Full AI Voice Notes & Copilot</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0"/> <span>Multi-Branch & Area Analytics</span></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0"/> <span>Lifetime Cloud Replicating Server</span></li>
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => openCheckout({
                key: 'LIFETIME',
                name: 'Lifetime VIP Founder Access',
                tier: 'LIFETIME',
                badge: 'Lifetime Ownership',
                priceUsd: 299,
                pricePkr: 83000,
                billingText: 'Pay once, never pay monthly or annual bills',
                color: 'amber',
                features: ['Unlimited Customers & Products', 'Full Factory MRP & OEE Floor', 'AI Copilot & OCR', 'Lifetime Cloud Sync', 'Zero Renewal Fees']
              })}
              className="w-full py-3 px-3 rounded-2xl font-black bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 transition-all flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-amber-500/20"
            >
              <Crown className="w-4 h-4" /> Claim Lifetime ($299)
            </button>
            <button 
              onClick={() => openCheckout({
                key: 'ULTRA_1Y',
                name: 'ULTRA Annual VIP',
                tier: 'PRO_PLUS',
                badge: 'Yearly Plan',
                priceUsd: 149,
                pricePkr: 41500,
                billingText: 'Billed yearly ($149/yr)',
                color: 'violet',
                features: ['Unlimited Customers & Products', 'Full Factory Production Suite', 'Multi-Branch Analytics', 'Google Drive Automated Backups']
              })}
              className="w-full py-2.5 px-3 rounded-2xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center justify-center gap-1 text-xs border border-slate-700"
            >
              1 Year ULTRA ($149)
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* PREMIUM DUMMY PAYMENT CHECKOUT MODAL */}
      {/* ========================================================================= */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white max-w-xl w-full rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col my-8 animate-in zoom-in-95 duration-200">
            
            {/* Modal Top Header with Dynamic Color */}
            <div className={`p-6 text-white ${
              selectedPlan.color === 'emerald' 
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700' 
                : selectedPlan.color === 'indigo'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-700'
                : selectedPlan.color === 'violet'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-800'
                : 'bg-gradient-to-r from-slate-950 via-amber-950 to-slate-900 border-b border-amber-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-white/10 backdrop-blur-sm">
                    {selectedPlan.color === 'amber' ? <Crown className="w-5 h-5 text-amber-400" /> : <Sparkles className="w-5 h-5 text-white" />}
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                      Sandbox Payment Gateway
                    </span>
                    <h2 className="text-xl font-black">{selectedPlan.name}</h2>
                  </div>
                </div>

                <button 
                  onClick={closeCheckout}
                  disabled={paymentStep === 'PROCESSING'}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 flex items-baseline justify-between pt-3 border-t border-white/10">
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    ${selectedPlan.priceUsd}
                  </span>
                  <span className="text-xs text-white/80 ml-1 font-medium">USD</span>
                </div>
                <div className="text-right">
                  <span className="text-base sm:text-lg font-bold text-white">
                    Rs {selectedPlan.pricePkr.toLocaleString()}
                  </span>
                  <p className="text-[11px] text-white/80">{selectedPlan.billingText}</p>
                </div>
              </div>
            </div>

            {/* STEP 1: FORM SELECTION & DUMMY INPUT */}
            {paymentStep === 'FORM' && (
              <div className="p-6 sm:p-7 flex flex-col gap-6">
                
                {/* Method Tabs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Select Payment Provider (Demo)
                    </label>
                    <button
                      type="button"
                      onClick={autoFillDemo}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Auto-fill Demo Details
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('EASYPAISA')}
                      className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                        paymentMethod === 'EASYPAISA' 
                          ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800 shadow-xs' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                        EP
                      </div>
                      <span className="text-xs font-bold">Easypaisa</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('JAZZCASH')}
                      className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                        paymentMethod === 'JAZZCASH' 
                          ? 'border-rose-500 bg-rose-50/70 text-rose-800 shadow-xs' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-xl bg-rose-600 text-white font-black text-xs flex items-center justify-center">
                        JC
                      </div>
                      <span className="text-xs font-bold">JazzCash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CARD')}
                      className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                        paymentMethod === 'CARD' 
                          ? 'border-indigo-500 bg-indigo-50/70 text-indigo-800 shadow-xs' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold">Debit / Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('RAAST')}
                      className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                        paymentMethod === 'RAAST' 
                          ? 'border-amber-500 bg-amber-50/70 text-amber-800 shadow-xs' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold">Raast / Bank</span>
                    </button>
                  </div>
                </div>

                {/* Dynamic Input Forms */}
                {(paymentMethod === 'EASYPAISA' || paymentMethod === 'JAZZCASH') && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-1">
                      <Smartphone className="w-4 h-4 text-slate-500" />
                      <span>{paymentMethod === 'EASYPAISA' ? 'Easypaisa Mobile Account' : 'JazzCash Mobile Wallet'}</span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">Mobile Account Number</label>
                      <input 
                        type="text"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="0300-1234567"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">Account Holder Name</label>
                      <input 
                        type="text"
                        value={accountTitle}
                        onChange={(e) => setAccountTitle(e.target.value)}
                        placeholder="e.g. Mansoor Trading"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === 'CARD' && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                      <span className="flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-indigo-600" /> Visa / Mastercard / SadaPay</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">Encrypted 256-bit</span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">Card Number</label>
                      <input 
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4000 1234 5678 9010"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">Expiry (MM/YY)</label>
                        <input 
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="12/28"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">CVC / CVV</label>
                        <input 
                          type="password"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          placeholder="888"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'RAAST' && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <Building2 className="w-4 h-4 text-amber-600" />
                      <span>State Bank Raast Instant Transfer</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Demo IBAN: <span className="font-mono font-bold text-slate-800">PK88MEZN00998877665544</span>
                    </p>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
                      Click the button below to simulate an instant Raast clearance for this license.
                    </div>
                  </div>
                )}

                {/* Order Summary */}
                <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>License Tier</span>
                    <span className="font-bold text-slate-800">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Platform Setup Fee</span>
                    <span className="text-emerald-600 font-bold">100% Waived (Rs 0)</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-100">
                    <span>Total Amount Payable</span>
                    <span className="text-emerald-600 text-base">
                      Rs {selectedPlan.pricePkr.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Submit Payment CTA */}
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm py-4 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" /> Confirm & Pay (Demo Mode)
                </button>

                <p className="text-[11px] text-center text-slate-400 font-medium flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Sandbox payment mode — No real bank charges will occur
                </p>
              </div>
            )}

            {/* STEP 2: REALISTIC PROGRESS SPINNER */}
            {paymentStep === 'PROCESSING' && (
              <div className="p-12 flex flex-col items-center justify-center text-center gap-4 my-8">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                  <Lock className="w-6 h-6 text-indigo-600 absolute inset-0 m-auto" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Processing Sandbox Payment</h3>
                  <p className="text-xs text-slate-500 mt-1">{processingStatus}</p>
                </div>
                <div className="w-full max-w-xs bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-indigo-600 rounded-full animate-pulse w-3/4" />
                </div>
              </div>
            )}

            {/* STEP 3: CELEBRATORY SUCCESS MODAL */}
            {paymentStep === 'SUCCESS' && (
              <div className="p-8 flex flex-col items-center justify-center text-center gap-5">
                <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-300">
                  <CheckCircle2 className="w-12 h-12" />
                </div>

                <div>
                  <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                    VIP Activated
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-2">
                    Payment Successful! 🎉
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md">
                    Your business has been upgraded to <b>{selectedPlan.name}</b>. All VIP features, countertop POS, and live cloud sync are unlocked!
                  </p>
                </div>

                <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transaction ID:</span>
                    <span className="font-mono font-bold text-slate-800">{transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount Paid:</span>
                    <span className="font-bold text-emerald-600">Rs {selectedPlan.pricePkr.toLocaleString()} (Demo)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gateway Provider:</span>
                    <span className="font-bold text-slate-800">{paymentMethod}</span>
                  </div>
                </div>

                <div className="w-full flex flex-col sm:flex-row gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => router.push('/erp')}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl text-xs shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    Open Countertop POS <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3.5 rounded-2xl text-xs shadow-xs transition"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
