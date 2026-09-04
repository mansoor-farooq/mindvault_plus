'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Task } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import {
  CheckCircle2, Circle, Clock, Plus, Trash2, ArrowLeft, Flag,
  Tag, AlertCircle, BarChart2, Filter, X, ChevronRight,
  ClipboardList, Zap, PackageSearch, Users, DollarSign, Layers, Star
} from 'lucide-react';
import Link from 'next/link';

type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
type TaskCategory = 'PURCHASE' | 'STAFF' | 'FINANCE' | 'INVENTORY' | 'GENERAL' | 'URGENT';

const CATEGORY_META: Record<TaskCategory, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  URGENT:    { label: 'Urgent',    color: 'text-rose-600',   bg: 'bg-rose-100',    icon: Zap },
  PURCHASE:  { label: 'Purchase',  color: 'text-amber-600',  bg: 'bg-amber-100',   icon: PackageSearch },
  STAFF:     { label: 'Staff',     color: 'text-indigo-600', bg: 'bg-indigo-100',  icon: Users },
  FINANCE:   { label: 'Finance',   color: 'text-emerald-600',bg: 'bg-emerald-100', icon: DollarSign },
  INVENTORY: { label: 'Inventory', color: 'text-purple-600', bg: 'bg-purple-100',  icon: Layers },
  GENERAL:   { label: 'General',   color: 'text-slate-600',  bg: 'bg-slate-100',   icon: ClipboardList },
};

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  HIGH:   { label: 'High',   color: 'text-rose-600',   dot: 'bg-rose-500' },
  MEDIUM: { label: 'Medium', color: 'text-amber-600',  dot: 'bg-amber-500' },
  LOW:    { label: 'Low',    color: 'text-slate-500',  dot: 'bg-slate-400' },
};

const STATUS_COLUMNS: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE'];
const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING:     'To Do',
  IN_PROGRESS: 'In Progress',
  DONE:        'Completed',
};

export default function TasksPage() {
  const [activeView, setActiveView] = useState<'BOARD' | 'REPORT'>('BOARD');
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<TaskCategory | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'ALL'>('ALL');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('GENERAL');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const tasks = useLiveQuery(
    () => db.tasks.filter(t => !t.isDeleted).toArray(),
    []
  ) || [];

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const catOk = filterCategory === 'ALL' || t.category === filterCategory;
      const priOk = filterPriority === 'ALL' || t.priority === filterPriority;
      return catOk && priOk;
    });
  }, [tasks, filterCategory, filterPriority]);

  const grouped = useMemo(() => {
    const g: Record<TaskStatus, Task[]> = { PENDING: [], IN_PROGRESS: [], DONE: [] };
    filtered.forEach(t => {
      if (g[t.status]) g[t.status].push(t);
    });
    (Object.keys(g) as TaskStatus[]).forEach(s => {
      g[s].sort((a, b) => {
        const pOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return 0;
      });
    });
    return g;
  }, [filtered]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'DONE').length;
    const overdue = tasks.filter(t => {
      if (!t.dueDate || t.status === 'DONE') return false;
      return t.dueDate < new Date().toISOString().split('T')[0];
    }).length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const byCat = Object.keys(CATEGORY_META).map(cat => ({
      cat: cat as TaskCategory,
      total: tasks.filter(t => t.category === cat).length,
      done: tasks.filter(t => t.category === cat && t.status === 'DONE').length,
    }));
    const recentlyDone = tasks
      .filter(t => t.status === 'DONE' && t.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
      .slice(0, 5);
    return { total, done, overdue, completionRate, byCat, recentlyDone };
  }, [tasks]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await db.tasks.add({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      status: 'PENDING',
      dueDate: dueDate || undefined,
      assignedTo: assignedTo.trim() || undefined,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    SyncService.sync();
    setTitle(''); setDescription(''); setCategory('GENERAL');
    setPriority('MEDIUM'); setDueDate(''); setAssignedTo('');
    setShowAddModal(false);
  };

  const cycleStatus = async (task: Task) => {
    const next: Record<TaskStatus, TaskStatus> = {
      PENDING: 'IN_PROGRESS',
      IN_PROGRESS: 'DONE',
      DONE: 'PENDING',
    };
    const newStatus = next[task.status];
    await db.tasks.update(task.id!, {
      status: newStatus,
      updatedAt: new Date(),
      completedAt: newStatus === 'DONE' ? new Date() : undefined,
    });
    SyncService.sync();
  };

  const deleteTask = async (task: Task) => {
    await db.tasks.update(task.id!, {
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    });
    SyncService.sync();
  };

  const isOverdue = (t: Task) =>
    t.dueDate && t.status !== 'DONE' && t.dueDate < new Date().toISOString().split('T')[0];

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-20">

      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm shrink-0">
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                Task Manager
              </h1>
              <p className="text-xs text-slate-400">
                {stats.total} tasks &bull; {stats.done} done
                {stats.overdue > 0 && <span className="text-rose-500 font-bold"> &bull; {stats.overdue} overdue!</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView(v => v === 'BOARD' ? 'REPORT' : 'BOARD')}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <BarChart2 className="w-4 h-4" />
              <span className="hidden sm:block">{activeView === 'BOARD' ? 'Report' : 'Board'}</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-200 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Task
            </button>
          </div>
        </div>

        <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value as TaskCategory | 'ALL')}
            className="bg-slate-100 border-0 text-slate-700 text-xs font-bold rounded-xl px-3 py-1.5 outline-none"
          >
            <option value="ALL">All Categories</option>
            {(Object.keys(CATEGORY_META) as TaskCategory[]).map(c => (
              <option key={c} value={c}>{CATEGORY_META[c].label}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as TaskPriority | 'ALL')}
            className="bg-slate-100 border-0 text-slate-700 text-xs font-bold rounded-xl px-3 py-1.5 outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
          {(filterCategory !== 'ALL' || filterPriority !== 'ALL') && (
            <button
              onClick={() => { setFilterCategory('ALL'); setFilterPriority('ALL'); }}
              className="text-rose-500 text-xs font-bold flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {activeView === 'BOARD' && (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 p-4 min-w-max items-start">
            {STATUS_COLUMNS.map(status => {
              const colBg: Record<TaskStatus, string> = {
                PENDING:     'bg-slate-200 text-slate-700',
                IN_PROGRESS: 'bg-amber-100 text-amber-700',
                DONE:        'bg-emerald-100 text-emerald-700',
              };
              return (
                <div key={status} className="w-80 shrink-0 flex flex-col gap-3">
                  <div className={`flex items-center justify-between px-4 py-2 rounded-xl font-bold text-sm ${colBg[status]}`}>
                    <span>{STATUS_LABELS[status]}</span>
                    <span className="w-6 h-6 rounded-full bg-white/60 flex items-center justify-center text-xs font-black">
                      {grouped[status].length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {grouped[status].length === 0 && (
                      <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-sm">
                        No tasks here
                      </div>
                    )}
                    {grouped[status].map(task => {
                      const cat = CATEGORY_META[task.category];
                      const pri = PRIORITY_META[task.priority];
                      const CatIcon = cat.icon;
                      const overdue = isOverdue(task);
                      return (
                        <div
                          key={task.id}
                          className={`bg-white rounded-2xl p-4 shadow-sm border transition-all hover:shadow-md ${
                            overdue ? 'border-rose-300 bg-rose-50/30' : 'border-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${cat.bg} ${cat.color}`}>
                              <CatIcon className="w-3 h-3" />
                              {cat.label}
                            </span>
                            <span className={`flex items-center gap-1 text-[10px] font-bold ${pri.color}`}>
                              <span className={`w-2 h-2 rounded-full ${pri.dot}`}></span>
                              {pri.label}
                            </span>
                          </div>
                          <p className={`font-bold text-sm text-slate-800 leading-snug mb-1 ${
                            task.status === 'DONE' ? 'line-through opacity-50' : ''
                          }`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-slate-400 mb-2 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-3 flex-wrap">
                            {task.dueDate && (
                              <span className={`flex items-center gap-0.5 font-medium ${
                                overdue ? 'text-rose-500 font-bold' : ''
                              }`}>
                                <Clock className="w-3 h-3" />
                                {overdue ? 'Overdue: ' : ''}{task.dueDate}
                              </span>
                            )}
                            {task.assignedTo && (
                              <span className="flex items-center gap-0.5">
                                <Users className="w-3 h-3" />
                                {task.assignedTo}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => cycleStatus(task)}
                              className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                                task.status === 'DONE'
                                  ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  : task.status === 'IN_PROGRESS'
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                              }`}
                            >
                              {task.status === 'DONE' ? (
                                <><CheckCircle2 className="w-3.5 h-3.5" /> Done</>
                              ) : task.status === 'IN_PROGRESS' ? (
                                <><CheckCircle2 className="w-3.5 h-3.5" /> Mark Done</>
                              ) : (
                                <><Circle className="w-3.5 h-3.5" /> Start</>
                              )}
                            </button>
                            <button
                              onClick={() => deleteTask(task)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeView === 'REPORT' && (
        <div className="p-4 max-w-3xl w-full mx-auto flex flex-col gap-6 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Tasks',     value: String(stats.total),                color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-200' },
              { label: 'Completed',       value: String(stats.done),                 color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: 'Completion Rate', value: stats.completionRate + '%',          color: 'text-violet-600', bg: 'bg-violet-50',  border: 'border-violet-200' },
              { label: 'Overdue',         value: String(stats.overdue),              color: 'text-rose-600',   bg: 'bg-rose-50',    border: 'border-rose-200' },
            ].map(card => (
              <div key={card.label} className={`${card.bg} border ${card.border} rounded-2xl p-4 text-center`}>
                <p className={`text-3xl font-black ${card.color}`}>{card.value}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <p className="font-bold text-slate-700">Overall Completion</p>
              <p className="font-black text-indigo-600">{stats.completionRate}%</p>
            </div>
            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-4 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-500" /> Category Breakdown
            </h2>
            <div className="flex flex-col gap-3">
              {stats.byCat.filter(c => c.total > 0).map(item => {
                const meta = CATEGORY_META[item.cat];
                const CatIcon = meta.icon;
                const pct = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
                return (
                  <div key={item.cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${meta.color}`}>
                        <CatIcon className="w-3.5 h-3.5" /> {meta.label}
                      </span>
                      <span className="text-xs text-slate-400">{item.done} / {item.total} done</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          pct === 100 ? 'bg-emerald-500' : 'bg-indigo-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {stats.byCat.every(c => c.total === 0) && (
                <p className="text-sm text-slate-400 text-center py-4">No tasks recorded yet.</p>
              )}
            </div>
          </div>

          {stats.recentlyDone.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" /> Recently Completed
              </h2>
              <div className="flex flex-col gap-2">
                {stats.recentlyDone.map(t => {
                  const meta = CATEGORY_META[t.category];
                  const CatIcon = meta.icon;
                  return (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-slate-700 line-through opacity-60">{t.title}</p>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${meta.color}`}>
                            <CatIcon className="w-2.5 h-2.5" /> {meta.label}
                          </span>
                        </div>
                      </div>
                      {t.completedAt && (
                        <span className="text-[10px] text-slate-400">
                          {new Date(t.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-slate-500" />
              <h2 className="font-bold text-slate-800">All Tasks Log</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Task</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tasks.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">No tasks yet.</td></tr>
                  )}
                  {tasks.map(t => {
                    const cat = CATEGORY_META[t.category];
                    const pri = PRIORITY_META[t.priority];
                    const overdue = isOverdue(t);
                    return (
                      <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${overdue ? 'bg-rose-50/40' : ''}`}>
                        <td className="px-4 py-3">
                          <p className={`font-semibold text-slate-800 ${t.status === 'DONE' ? 'line-through opacity-50' : ''}`}>
                            {t.title}
                          </p>
                          {t.assignedTo && <p className="text-[10px] text-slate-400">{t.assignedTo}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${cat.color}`}>{cat.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-xs font-bold ${pri.color}`}>
                            <span className={`w-2 h-2 rounded-full ${pri.dot}`}></span>
                            {pri.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            t.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' :
                            t.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {STATUS_LABELS[t.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {t.dueDate ? (
                            <span className={overdue ? 'text-rose-500 font-bold' : ''}>
                              {overdue ? 'OVERDUE: ' : ''}{t.dueDate}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 my-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" /> New Task
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Task Title *</label>
                <input
                  type="text" required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Buy raw cotton from supplier"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="More details..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as TaskCategory)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    {(Object.keys(CATEGORY_META) as TaskCategory[]).map(c => (
                      <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as TaskPriority)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    min={todayStr}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Assign To</label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={e => setAssignedTo(e.target.value)}
                    placeholder="e.g. Manager, Ali"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 transition-colors"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
