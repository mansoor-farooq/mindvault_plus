"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, Coins, CheckCircle2, XCircle, Sparkles, Loader2, RotateCcw, Gift } from 'lucide-react';
import Link from 'next/link';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

interface QuizStatus {
  mindcoins: number;
  answeredToday: number;
  dailyLimit: number;
  redeemCost: number;
  redeemAiBonus: number;
}

export default function GamesPage() {
  const token = useAuthStore((s) => s.token);
  const [status, setStatus] = useState<QuizStatus | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; correctIndex: number; explanation: string; pointsAwarded: number } | null>(null);
  const [sessionScore, setSessionScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const loadGame = useCallback(async () => {
    if (!token) { setError('Please sync/login first to play.'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [statusRes, questionsRes] = await Promise.all([
        fetch(`/api/games/status`, { headers: authHeaders }),
        fetch(`/api/games/quiz/questions`, { headers: authHeaders }),
      ]);
      if (!statusRes.ok || !questionsRes.ok) throw new Error('Failed to load game');
      setStatus(await statusRes.json());
      const q = await questionsRes.json();
      setQuestions(q.questions);
      setCurrent(0);
      setSelected(null);
      setResult(null);
      setSessionScore(0);
    } catch {
      setError('Could not load the quiz. Is the backend running?');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { loadGame(); }, [loadGame]);

  const answer = async (index: number) => {
    if (submitting || result) return;
    setSelected(index);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/games/quiz/answer`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ questionId: questions[current].id, answerIndex: index }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'QUIZ_DAILY_LIMIT_REACHED') {
          setError(`You've answered your ${data.limit} free questions for today. Come back tomorrow!`);
        } else {
          setError('Something went wrong.');
        }
        return;
      }
      setResult(data);
      if (data.correct) {
        setSessionScore((s) => s + 1);
        setToast(`+${data.pointsAwarded} MindCoins!`);
        setTimeout(() => setToast(null), 1800);
      }
      setStatus((prev) => prev ? { ...prev, mindcoins: data.totalMindcoins, answeredToday: prev.answeredToday + 1 } : prev);
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = () => {
    setSelected(null);
    setResult(null);
    setCurrent((c) => c + 1);
  };

  const redeem = async () => {
    setRedeeming(true);
    try {
      const res = await fetch(`/api/games/redeem`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === 'INSUFFICIENT_COINS' ? `You need ${data.need} MindCoins (you have ${data.have}).` : 'Redeem failed.');
        return;
      }
      setToast(`Redeemed! +${data.aiQuotaGained} AI uses unlocked`);
      setTimeout(() => setToast(null), 2000);
      setStatus((prev) => prev ? { ...prev, mindcoins: prev.mindcoins - data.coinsSpent } : prev);
    } finally {
      setRedeeming(false);
    }
  };

  const isDone = current >= questions.length;

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 flex items-center justify-between shadow-lg shadow-indigo-200/50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-xl font-bold tracking-wide">Money Quiz</h1>
        </div>
        {status && (
          <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full text-sm font-bold">
            <Coins className="w-4 h-4 text-amber-400" />
            {status.mindcoins}
          </div>
        )}
      </header>

      <div className="flex-1 p-4 max-w-lg w-full mx-auto flex flex-col gap-4 relative">
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 bg-emerald-500 text-white font-bold text-sm px-4 py-2 rounded-full shadow-xl animate-bounce">
            {toast}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading quiz...
          </div>
        ) : error && !status ? (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl p-4 text-center">{error}</div>
        ) : isDone ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Round Complete!</h2>
            <p className="text-gray-500">You got {sessionScore} out of {questions.length} correct.</p>
            <button
              onClick={loadGame}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-full font-medium hover:bg-indigo-700"
            >
              <RotateCcw className="w-4 h-4" /> Play Again
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-400">
              <span>Question {current + 1} of {questions.length}</span>
              {status && <span>{status.answeredToday}/{status.dailyLimit} answered today</span>}
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl p-3">{error}</div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-gray-800 leading-snug">{questions[current]?.question}</h2>

              <div className="flex flex-col gap-2.5">
                {questions[current]?.options.map((opt, i) => {
                  let style = 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700';
                  if (result) {
                    if (i === result.correctIndex) style = 'bg-emerald-50 border-emerald-300 text-emerald-700';
                    else if (i === selected) style = 'bg-rose-50 border-rose-300 text-rose-700';
                    else style = 'bg-gray-50 border-gray-200 text-gray-400';
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => answer(i)}
                      disabled={submitting || !!result}
                      className={`text-left px-4 py-3 rounded-xl border font-medium text-sm transition-all ${style} ${selected === i && !result ? 'scale-[0.98]' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{opt}</span>
                        {result && i === result.correctIndex && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                        {result && i === selected && i !== result.correctIndex && <XCircle className="w-4 h-4 flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {result && (
                <div className="pt-2 border-t border-gray-100 flex flex-col gap-3">
                  <p className="text-xs text-gray-500">{result.explanation}</p>
                  <button
                    onClick={nextQuestion}
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700"
                  >
                    {current + 1 < questions.length ? 'Next Question' : 'See Results'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {status && status.mindcoins >= status.redeemCost && (
          <button
            onClick={redeem}
            disabled={redeeming}
            className="flex items-center justify-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 py-3 rounded-xl font-bold text-sm hover:bg-amber-100 disabled:opacity-50"
          >
            {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            Redeem {status.redeemCost} MindCoins &rarr; +{status.redeemAiBonus} AI uses
          </button>
        )}
      </div>
    </main>
  );
}
