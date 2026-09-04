'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface RejectedItem {
  entity: string;
  syncId: string;
  reason: string;
  message: string;
}

export function SyncRejectionBanner() {
  const [rejections, setRejections] = useState<RejectedItem[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleRejections = (e: Event) => {
      const customEvent = e as CustomEvent<RejectedItem[]>;
      if (customEvent.detail && customEvent.detail.length > 0) {
        setRejections(customEvent.detail);
        setVisible(true);
      }
    };

    window.addEventListener('sync:rejected_changes', handleRejections);
    return () => {
      window.removeEventListener('sync:rejected_changes', handleRejections);
    };
  }, []);

  if (!visible || rejections.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md bg-amber-950/90 border border-amber-500/30 text-amber-200 p-4 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-amber-300">
            {rejections.length} tabdeelian sync nahi ho sakein (Permission Denied)
          </p>
          <p className="text-xs text-amber-200/80 mt-1">
            {rejections[0].message}
            {rejections.length > 1 && ` (+${rejections.length - 1} aur items)`}
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-amber-400 hover:text-amber-200 transition p-1"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
