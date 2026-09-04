'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { 
  Mail, MessageSquare, Send, CheckCircle2, AlertCircle, 
  Clock, ShieldCheck, HelpCircle, Phone, ArrowLeft, Loader2, Sparkles
} from 'lucide-react';
import Link from 'next/link';

export default function ContactPage() {
  const user = useAuthStore((s) => s.user);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('General Support');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-populate with logged in user data if available
  useEffect(() => {
    if (user) {
      if (user.fullName) setName(user.fullName);
      if (user.email) setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!message.trim() || message.trim().length < 5) {
      setError('Message must be at least 5 characters long.');
      return;
    }

    setLoading(true);
    try {
      const formattedSubject = subject.trim() ? `[${category}] ${subject.trim()}` : `[${category}] Support Request`;

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          subject: formattedSubject,
          message: message.trim(),
          accountEmail: user?.email,
          userRole: user?.role,
          businessType: user?.businessType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message.');
      }

      setSuccess(data.message || 'Your message has been sent successfully!');
      setMessage('');
      setSubject('');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while sending your message.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb / Top Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-100/80 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SMTP Live Support Active
          </div>
        </div>

        {/* Page Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-violet-800 rounded-3xl p-8 text-white shadow-xl shadow-indigo-950/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="relative z-10 max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" /> MindVault Helpdesk
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
              Get in Touch with Us
            </h1>
            <p className="text-indigo-100 text-sm lg:text-base leading-relaxed">
              Have a question, feedback, feature request, or need technical assistance with your MindVault POS & ERP system? Send us a direct email inquiry below.
            </p>
          </div>
        </div>

        {/* Main Grid: Form (Left) & Contact Cards (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Form Container (2 cols on large) */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" /> Send a Message
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Fill out the form below. Messages are dispatched directly to our support mailbox via official SMTP.
              </p>
            </div>

            {/* Alert Messages */}
            {success && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 text-sm animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Inquiry Dispatched Successfully!</p>
                  <p className="text-xs text-emerald-700">{success}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Unable to Send Message</p>
                  <p className="text-xs text-rose-700">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Your Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Waqar Farooq"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phone / WhatsApp */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone / WhatsApp (Optional)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Inquiry Topic
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  >
                    <option value="General Support">General Support</option>
                    <option value="Billing & Plans">Billing & Subscriptions (Pro / Ultra)</option>
                    <option value="Bug Report">Technical Issue / Bug Report</option>
                    <option value="Feature Request">New Feature Suggestion</option>
                    <option value="Custom ERP Setup">Custom Setup & Integration</option>
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your inquiry..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Message <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={5}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Explain what you need assistance with in detail..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-y"
                ></textarea>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending via SMTP...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Contact Cards & Info */}
          <div className="space-y-6">
            {/* Direct Email Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Direct Support Email</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reach out directly via your preferred email client:
                </p>
                <a
                  href="mailto:aw.waqarporfolio11@gmail.com"
                  className="mt-2 inline-block font-semibold text-sm text-indigo-600 hover:text-indigo-800 break-all transition-colors"
                >
                  aw.waqarporfolio11@gmail.com
                </a>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Typical response within 24 hours</span>
              </div>
            </div>

            {/* Security & Verification Card */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md space-y-3">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" /> SSL / TLS Encrypted
              </div>
              <h4 className="text-sm font-bold text-white">
                Secure SMTP Relay
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                All communications sent through this portal are authenticated and encrypted using Google SMTP (Port 465 SSL) for data privacy and deliverability.
              </p>
            </div>

            {/* Quick Tips */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-6 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                <HelpCircle className="w-4 h-4 text-amber-600" /> Quick Assistance
              </div>
              <p className="text-xs text-amber-900/90 leading-relaxed">
                Need to manage subscription plans? You can check available packages or upgrade anytime from our{' '}
                <Link href="/upgrade" className="font-bold underline hover:text-amber-700">
                  Upgrade & Pricing
                </Link>{' '}
                portal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
