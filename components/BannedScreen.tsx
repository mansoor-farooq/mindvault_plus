import { useState } from 'react';
import { LogOut, Phone, Mail, ShieldAlert, Copy, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface BannedScreenProps {
  onBack?: () => void;
}

export default function BannedScreen({ onBack }: BannedScreenProps) {
  const { logout } = useAuthStore();
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleAction = () => {
    if (onBack) {
      onBack();
    } else {
      logout();
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] bg-red-600/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/10 blur-[80px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center">
        
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 p-[2px] shadow-lg shadow-red-500/30 mb-6 relative">
          <div className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-500 animate-pulse" />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-200 mb-3">
          Account Suspended
        </h1>
        
        <p className="text-slate-300 mb-8 text-sm leading-relaxed">
          Your access to MindVault has been restricted by the administrator. To restore access or purchase a license, please contact support.
        </p>

        <div className="w-full bg-black/40 rounded-2xl p-5 border border-white/5 mb-8">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Support Contact (Click to copy)</h2>
          
          <div className="flex flex-col gap-4 text-left">
            <button 
              onClick={() => handleCopy('03292597331')}
              className="w-full flex items-center justify-between group hover:bg-white/5 p-2 rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white/10 p-2.5 rounded-lg text-rose-300 group-hover:scale-110 group-hover:bg-rose-500/20 transition-all">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-400 mb-0.5">Phone Number</p>
                  <p className="text-sm font-semibold text-slate-200">03292597331</p>
                </div>
              </div>
              {copiedText === '03292597331' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
            
            <button 
              onClick={() => handleCopy('mansoorturk757@gmail.com')}
              className="w-full flex items-center justify-between group hover:bg-white/5 p-2 rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white/10 p-2.5 rounded-lg text-rose-300 group-hover:scale-110 group-hover:bg-rose-500/20 transition-all">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-400 mb-0.5">Email Address</p>
                  <p className="text-sm font-semibold text-slate-200">mansoorturk757@gmail.com</p>
                </div>
              </div>
              {copiedText === 'mansoorturk757@gmail.com' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
          </div>
        </div>

        <button 
          onClick={handleAction}
          className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-3.5 rounded-xl font-medium transition-all shadow-lg flex items-center justify-center gap-2 group"
        >
          <LogOut className="w-4 h-4 text-slate-300 group-hover:-translate-x-1 transition-transform" /> 
          {onBack ? "Back to Login" : "Sign out safely"}
        </button>
      </div>
    </div>
  );
}
