"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, MapPin, Bell, BellOff, Loader2, AlertTriangle, Moon, Sunrise, Sun, Sunset, CloudMoon } from 'lucide-react';
import Link from 'next/link';

const PRAYERS: { key: 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'; label: string; icon: React.ElementType; isReminder: boolean }[] = [
  { key: 'fajr', label: 'Fajr', icon: CloudMoon, isReminder: true },
  { key: 'sunrise', label: 'Sunrise', icon: Sunrise, isReminder: false },
  { key: 'dhuhr', label: 'Dhuhr', icon: Sun, isReminder: true },
  { key: 'asr', label: 'Asr', icon: Sun, isReminder: true },
  { key: 'maghrib', label: 'Maghrib', icon: Sunset, isReminder: true },
  { key: 'isha', label: 'Isha', icon: Moon, isReminder: true },
];

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function PrayerTimesPage() {
  const user = useAuthStore((s) => s.user);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [remindersOn, setRemindersOn] = useState(!!user?.namazRemindersEnabled);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const scheduledTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission('unsupported');
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError('Your browser does not support location access.');
      setLocLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
      },
      () => {
        setLocError('Location access denied. Enable it in your browser to see accurate prayer times for your area.');
        setLocLoading(false);
      },
      { timeout: 10000 }
    );
  }, []);

  const times = useMemo(() => {
    if (!coords) return null;
    const coordinates = new Coordinates(coords.lat, coords.lng);
    const params = CalculationMethod.MuslimWorldLeague();
    return new PrayerTimes(coordinates, new Date(), params);
  }, [coords]);

  const nextPrayerKey = times?.nextPrayer();

  // Schedule in-tab browser notifications for today's remaining prayer times.
  // This only fires while this page/tab stays open - full background push
  // notifications need a service worker, which is separate, larger, queued work.
  useEffect(() => {
    scheduledTimers.current.forEach(clearTimeout);
    scheduledTimers.current = [];

    if (!remindersOn || !times || notifPermission !== 'granted') return;

    const now = Date.now();
    for (const p of PRAYERS) {
      if (!p.isReminder) continue;
      const time = times[p.key];
      const delay = time.getTime() - now;
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const timer = setTimeout(() => {
          new Notification(`${p.label} time`, { body: `It's time for ${p.label} prayer.`, icon: '/favicon.ico' });
        }, delay);
        scheduledTimers.current.push(timer);
      }
    }
    return () => { scheduledTimers.current.forEach(clearTimeout); };
  }, [remindersOn, times, notifPermission]);

  const enableReminders = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      setRemindersOn(true);
      if (user?.id) {
        const { db } = await import('@/lib/db');
        await db.users.update(user.id, { namazRemindersEnabled: true });
        useAuthStore.getState().updateUser({ namazRemindersEnabled: true });
      }
    }
  };

  const disableReminders = async () => {
    setRemindersOn(false);
    if (user?.id) {
      const { db } = await import('@/lib/db');
      await db.users.update(user.id, { namazRemindersEnabled: false });
      useAuthStore.getState().updateUser({ namazRemindersEnabled: false });
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 flex items-center justify-between shadow-lg shadow-indigo-200/50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-xl font-bold tracking-wide">Prayer Times</h1>
        </div>
      </header>

      <div className="flex-1 p-4 max-w-lg w-full mx-auto flex flex-col gap-4">
        {locLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Getting your location...
          </div>
        ) : locError ? (
          <div className="bg-amber-50 border border-amber-100 text-amber-700 text-sm rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{locError}</span>
          </div>
        ) : times ? (
          <>
            <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
              <MapPin className="w-3.5 h-3.5" />
              Based on your current location &middot; {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              {PRAYERS.map((p) => {
                const Icon = p.icon;
                const isNext = nextPrayerKey === p.key;
                return (
                  <div
                    key={p.key}
                    className={`flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 ${isNext ? 'bg-indigo-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isNext ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`font-semibold ${isNext ? 'text-indigo-700' : 'text-gray-700'}`}>{p.label}</span>
                      {isNext && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full">NEXT</span>}
                    </div>
                    <span className={`font-bold ${isNext ? 'text-indigo-700' : 'text-gray-600'}`}>{formatTime(times[p.key])}</span>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              {notifPermission === 'unsupported' ? (
                <p className="text-xs text-gray-400 text-center">Notifications aren&apos;t supported in this browser.</p>
              ) : remindersOn && notifPermission === 'granted' ? (
                <button onClick={disableReminders} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-gray-600 py-2">
                  <BellOff className="w-4 h-4" /> Turn off reminders
                </button>
              ) : (
                <button onClick={enableReminders} className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-indigo-700">
                  <Bell className="w-4 h-4" /> Enable prayer time reminders
                </button>
              )}
              <p className="text-[11px] text-gray-400 text-center mt-2">Reminders fire while MindVault is open in your browser.</p>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
