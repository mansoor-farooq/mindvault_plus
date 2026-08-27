"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, X, Calculator, Percent, TrendingUp, Receipt, Scale } from 'lucide-react';

type ToolId = 'emi' | 'interest' | 'margin' | 'tax' | 'unit';

const TOOLS: { id: ToolId; title: string; subtitle: string; icon: React.ElementType; color: string; bg: string }[] = [
  { id: 'emi', title: 'EMI Calculator', subtitle: 'Loan monthly installment', icon: Calculator, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'interest', title: 'Interest Calculator', subtitle: 'For udhaar & lending', icon: Percent, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'margin', title: 'Profit Margin', subtitle: 'Cost vs selling price', icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'tax', title: 'GST / Tax Calculator', subtitle: 'Add or remove tax', icon: Receipt, color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 'unit', title: 'Unit Converter', subtitle: 'Weight, for inventory', icon: Scale, color: 'text-rose-500', bg: 'bg-rose-50' },
];

export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 flex items-center justify-between shadow-lg shadow-indigo-200/50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-xl font-bold tracking-wide">Tools</h1>
        </div>
      </header>

      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl w-full mx-auto">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 hover:shadow-lg hover:-translate-y-1 transition-all text-center"
          >
            <div className={`${tool.bg} ${tool.color} p-3 rounded-full`}>
              <tool.icon className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-gray-700 text-sm block">{tool.title}</span>
              <span className="text-[11px] text-gray-400">{tool.subtitle}</span>
            </div>
          </button>
        ))}
      </div>

      {activeTool === 'emi' && <ToolModal title="EMI Calculator" onClose={() => setActiveTool(null)}><EmiCalculator /></ToolModal>}
      {activeTool === 'interest' && <ToolModal title="Interest Calculator" onClose={() => setActiveTool(null)}><InterestCalculator /></ToolModal>}
      {activeTool === 'margin' && <ToolModal title="Profit Margin" onClose={() => setActiveTool(null)}><MarginCalculator /></ToolModal>}
      {activeTool === 'tax' && <ToolModal title="GST / Tax Calculator" onClose={() => setActiveTool(null)}><TaxCalculator /></ToolModal>}
      {activeTool === 'unit' && <ToolModal title="Unit Converter" onClose={() => setActiveTool(null)}><UnitConverter /></ToolModal>}
    </main>
  );
}

function ToolModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl bg-white shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${highlight ? 'font-bold text-indigo-700' : 'text-gray-600'}`}>
      <span className="text-sm">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function fmt(n: number) {
  if (!isFinite(n)) return '-';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function EmiCalculator() {
  const [principal, setPrincipal] = useState('100000');
  const [rate, setRate] = useState('12');
  const [tenure, setTenure] = useState('12');

  const { emi, totalInterest, totalPayment } = useMemo(() => {
    const p = parseFloat(principal) || 0;
    const r = (parseFloat(rate) || 0) / 12 / 100;
    const n = parseFloat(tenure) || 0;
    if (p <= 0 || n <= 0) return { emi: 0, totalInterest: 0, totalPayment: 0 };
    const emiVal = r === 0 ? p / n : (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = emiVal * n;
    return { emi: emiVal, totalInterest: total - p, totalPayment: total };
  }, [principal, rate, tenure]);

  return (
    <div className="space-y-4">
      <NumField label="Loan Amount (Rs.)" value={principal} onChange={setPrincipal} />
      <NumField label="Annual Interest Rate" value={rate} onChange={setRate} suffix="%" />
      <NumField label="Tenure" value={tenure} onChange={setTenure} suffix="months" />
      <div className="pt-3 mt-2 border-t border-gray-100">
        <ResultRow label="Monthly EMI" value={`Rs. ${fmt(emi)}`} highlight />
        <ResultRow label="Total Interest" value={`Rs. ${fmt(totalInterest)}`} />
        <ResultRow label="Total Payment" value={`Rs. ${fmt(totalPayment)}`} />
      </div>
    </div>
  );
}

function InterestCalculator() {
  const [principal, setPrincipal] = useState('10000');
  const [rate, setRate] = useState('5');
  const [months, setMonths] = useState('6');

  const { interest, total } = useMemo(() => {
    const p = parseFloat(principal) || 0;
    const r = parseFloat(rate) || 0;
    const t = (parseFloat(months) || 0) / 12;
    const interestVal = (p * r * t) / 100;
    return { interest: interestVal, total: p + interestVal };
  }, [principal, rate, months]);

  return (
    <div className="space-y-4">
      <NumField label="Principal Amount (Rs.)" value={principal} onChange={setPrincipal} />
      <NumField label="Annual Interest Rate" value={rate} onChange={setRate} suffix="%" />
      <NumField label="Duration" value={months} onChange={setMonths} suffix="months" />
      <div className="pt-3 mt-2 border-t border-gray-100">
        <ResultRow label="Interest Amount" value={`Rs. ${fmt(interest)}`} highlight />
        <ResultRow label="Total Payable" value={`Rs. ${fmt(total)}`} />
      </div>
    </div>
  );
}

function MarginCalculator() {
  const [cost, setCost] = useState('100');
  const [selling, setSelling] = useState('130');

  const { profit, marginPct, markupPct } = useMemo(() => {
    const c = parseFloat(cost) || 0;
    const s = parseFloat(selling) || 0;
    const profitVal = s - c;
    return {
      profit: profitVal,
      marginPct: s > 0 ? (profitVal / s) * 100 : 0,
      markupPct: c > 0 ? (profitVal / c) * 100 : 0,
    };
  }, [cost, selling]);

  return (
    <div className="space-y-4">
      <NumField label="Cost Price (Rs.)" value={cost} onChange={setCost} />
      <NumField label="Selling Price (Rs.)" value={selling} onChange={setSelling} />
      <div className="pt-3 mt-2 border-t border-gray-100">
        <ResultRow label="Profit" value={`Rs. ${fmt(profit)}`} highlight />
        <ResultRow label="Profit Margin" value={`${fmt(marginPct)}%`} />
        <ResultRow label="Markup" value={`${fmt(markupPct)}%`} />
      </div>
    </div>
  );
}

function TaxCalculator() {
  const [amount, setAmount] = useState('1000');
  const [rate, setRate] = useState('17');
  const [mode, setMode] = useState<'add' | 'remove'>('add');

  const { taxAmount, netAmount, grossAmount } = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 0;
    if (mode === 'add') {
      const tax = (a * r) / 100;
      return { taxAmount: tax, netAmount: a, grossAmount: a + tax };
    }
    const net = a / (1 + r / 100);
    return { taxAmount: a - net, netAmount: net, grossAmount: a };
  }, [amount, rate, mode]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
        <button
          onClick={() => setMode('add')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${mode === 'add' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
        >
          Add Tax
        </button>
        <button
          onClick={() => setMode('remove')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${mode === 'remove' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
        >
          Remove Tax
        </button>
      </div>
      <NumField label={mode === 'add' ? 'Amount (excl. tax)' : 'Amount (incl. tax)'} value={amount} onChange={setAmount} />
      <NumField label="Tax Rate" value={rate} onChange={setRate} suffix="%" />
      <div className="pt-3 mt-2 border-t border-gray-100">
        <ResultRow label="Tax Amount" value={`Rs. ${fmt(taxAmount)}`} highlight />
        <ResultRow label="Net Amount" value={`Rs. ${fmt(netAmount)}`} />
        <ResultRow label="Gross Amount" value={`Rs. ${fmt(grossAmount)}`} />
      </div>
    </div>
  );
}

const WEIGHT_UNITS: Record<string, number> = { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495, ton: 1000, maund: 37.3242 };

function UnitConverter() {
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState('kg');
  const [to, setTo] = useState('lb');

  const result = useMemo(() => {
    const v = parseFloat(value) || 0;
    const kg = v * WEIGHT_UNITS[from];
    return kg / WEIGHT_UNITS[to];
  }, [value, from, to]);

  return (
    <div className="space-y-4">
      <NumField label="Value" value={value} onChange={setValue} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {Object.keys(WEIGHT_UNITS).map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {Object.keys(WEIGHT_UNITS).map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div className="pt-3 mt-2 border-t border-gray-100">
        <ResultRow label="Result" value={`${fmt(result)} ${to}`} highlight />
      </div>
    </div>
  );
}
