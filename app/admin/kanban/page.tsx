"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { Kanban, Plus, MoreHorizontal, MessageSquare, Paperclip, CheckCircle2, Clock } from 'lucide-react';

interface KanbanTask {
  id: string;
  title: string;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  assignee: string;
  comments: number;
  status: 'To Do' | 'In Progress' | 'In Review' | 'Done';
}

const INITIAL_TASKS: KanbanTask[] = [
  { id: '1', title: 'Design Minimal UI Customizer Drawer', category: 'Design System', priority: 'High', assignee: 'SJ', comments: 12, status: 'To Do' },
  { id: '2', title: 'Refactor IndexedDB UUID Sync Engine', category: 'Backend Engine', priority: 'High', assignee: 'LO', comments: 8, status: 'In Progress' },
  { id: '3', title: 'Audit JWT Admin Roles Security', category: 'Security', priority: 'Medium', assignee: 'MV', comments: 4, status: 'In Review' },
  { id: '4', title: 'Implement Interactive SVG Charts', category: 'Frontend UI', priority: 'Low', assignee: 'SJ', comments: 15, status: 'Done' },
];

export default function KanbanBoardPage() {
  const { palette, mode } = useAdminTheme();
  const [tasks, setTasks] = useState<KanbanTask[]>(INITIAL_TASKS);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);

  const moveTask = (id: string, nextStatus: 'To Do' | 'In Progress' | 'In Review' | 'Done') => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
  };

  const handleAddTask = (column: 'To Do' | 'In Progress' | 'In Review' | 'Done') => {
    if (!newTaskTitle.trim()) return;
    const newTask: KanbanTask = {
      id: Date.now().toString(),
      title: newTaskTitle,
      category: 'General',
      priority: 'Medium',
      assignee: 'SJ',
      comments: 0,
      status: column,
    };
    setTasks((prev) => [...prev, newTask]);
    setNewTaskTitle('');
    setAddingToColumn(null);
  };

  const COLUMNS: ('To Do' | 'In Progress' | 'In Review' | 'Done')[] = ['To Do', 'In Progress', 'In Review', 'Done'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Interactive Kanban Board</h1>
          <p className="text-xs text-gray-400">Organize task sprints, priorities & dev workflow</p>
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
        {COLUMNS.map((column) => {
          const colTasks = tasks.filter((t) => t.status === column);
          return (
            <div
              key={column}
              className={`p-4 rounded-3xl border shadow-sm space-y-4 ${
                mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">{column}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-light text-primary">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setAddingToColumn(column)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Add Task Input Form */}
              {addingToColumn === column && (
                <div className="p-3 rounded-2xl border border-primary/40 bg-primary-light/10 space-y-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Enter task title..."
                    className="w-full p-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 text-xs font-bold">
                    <button
                      onClick={() => setAddingToColumn(null)}
                      className="px-2.5 py-1 text-gray-400 hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAddTask(column)}
                      className="px-3 py-1 rounded-lg text-white"
                      style={{ background: palette.primary }}
                    >
                      Add Task
                    </button>
                  </div>
                </div>
              )}

              {/* Task Cards */}
              <div className="space-y-3">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800/80 bg-gray-50/40 dark:bg-gray-900/40 space-y-3 shadow-xs hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        task.priority === 'High'
                          ? 'bg-rose-500/10 text-rose-500'
                          : task.priority === 'Medium'
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        {task.priority} Priority
                      </span>
                      <span className="text-[10px] text-gray-400 font-semibold">{task.category}</span>
                    </div>

                    <h4 className="font-bold text-xs leading-snug">{task.title}</h4>

                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-[11px] text-gray-400">
                        <MessageCircleIcon className="w-3.5 h-3.5" />
                        <span>{task.comments}</span>
                      </div>

                      {/* Move Column Selector */}
                      <select
                        value={task.status}
                        onChange={(e) => moveTask(task.id, e.target.value as any)}
                        className="text-[10px] font-bold bg-transparent text-primary outline-none cursor-pointer"
                      >
                        <option value="To Do">Move: To Do</option>
                        <option value="In Progress">Move: In Progress</option>
                        <option value="In Review">Move: In Review</option>
                        <option value="Done">Move: Done</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MessageCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return <MessageSquare {...props} />;
}
