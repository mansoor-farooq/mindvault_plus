'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, XCircle, Clock, ShieldCheck, Store, Calendar, Check, AlertTriangle } from 'lucide-react';

interface DeliveryDetails {
  syncId: string;
  date: string;
  status: 'received' | 'not_received' | 'skipped';
  quantity?: number;
  markedBy: string;
  source: string;
  confirmedAt?: string;
  customerName: string;
  serviceName: string;
  serviceUnit?: string;
  businessName?: string;
  ownerName?: string;
}

export default function ConfirmServicePage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/services/confirm/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Record not found');
        }
        return res.json();
      })
      .then((data) => {
        setDelivery(data.delivery);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const handleConfirm = async (status: 'received' | 'not_received') => {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/services/confirm/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      setMessage(data.message);
      if (delivery) {
        setDelivery({
          ...delivery,
          status,
          markedBy: 'customer',
          source: 'whatsapp_link',
          confirmedAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message || 'Error updating status');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-md w-full">
          <Clock className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Record Load Ho Raha Hai...</h2>
          <p className="text-slate-500 text-sm mt-2">Barahe karam intezar farmayein.</p>
        </div>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-md w-full">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Link Expired Ya Invalid Hai</h2>
          <p className="text-slate-600 text-sm mt-2">{error || 'Yeh delivery record daryaft nahi ho saka.'}</p>
        </div>
      </div>
    );
  }

  const isCustomerConfirmed = delivery.markedBy === 'customer';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-10 px-4 sm:px-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-900 text-white p-6 text-center relative">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-2xl mb-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-black">Rozana Service Verification</h1>
          <p className="text-indigo-200 text-xs mt-1">2-Way Digital Delivery Confirmation</p>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* Shop & Customer Badge */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <Store className="w-4 h-4 text-indigo-600" /> Dukan / Business:
              </span>
              <span className="font-bold text-slate-800">{delivery.businessName || delivery.ownerName || 'MSME Shop'}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">Grahak (Customer):</span>
              <span className="font-bold text-slate-800">{delivery.customerName}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-indigo-600" /> Tareekh (Date):
              </span>
              <span className="font-bold text-slate-800">{delivery.date}</span>
            </div>
          </div>

          {/* Service Details Card */}
          <div className="border border-indigo-100 bg-indigo-50/50 rounded-2xl p-4 text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Service Ki Maloomat</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {delivery.serviceName}
            </h3>
            <p className="text-sm font-semibold text-slate-600 mt-1">
              Miqdar (Quantity): <span className="text-indigo-700 font-bold">{delivery.quantity || 1} {delivery.serviceUnit || 'Unit'}</span>
            </p>
          </div>

          {/* Current Status Badge */}
          <div className="text-center py-2">
            <span className="text-xs text-slate-500 block mb-1">Filhal Status:</span>
            {delivery.status === 'received' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Received (Pohnch Gaya)
              </span>
            ) : delivery.status === 'not_received' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-bold">
                <XCircle className="w-3.5 h-3.5 text-rose-600" /> Nahi Mila (Disputed)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-600" /> Skipped / Chutti
              </span>
            )}
            {isCustomerConfirmed && (
              <span className="block text-[11px] text-slate-400 mt-1.5">
                (Aap ne khud tasdeeq ki hai)
              </span>
            )}
          </div>

          {/* Feedback message */}
          {message && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {message}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => handleConfirm('received')}
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              Maine Receive Kar Liya Hai (Yes, Received)
            </button>

            <button
              onClick={() => handleConfirm('not_received')}
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl font-bold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition-colors flex items-center justify-center gap-2 text-xs disabled:opacity-50 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              Mujhe Aaj Nahi Mila (Not Received)
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-400">
            Yeh verification seedha dukan ke Digital Khata se linked hai taake mahana hisab mein koi ghalti na ho.
          </p>
        </div>
      </div>
    </div>
  );
}
