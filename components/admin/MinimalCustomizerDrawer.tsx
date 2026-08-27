"use client";

import React from 'react';
import { useAdminTheme, COLOR_PRESETS, ColorPreset } from '@/context/AdminThemeContext';
import { Settings, X, Sun, Moon, RotateCcw, Layout, Sparkles, Check } from 'lucide-react';

export default function MinimalCustomizerDrawer() {
  const {
    mode,
    toggleMode,
    colorPreset,
    setColorPreset,
    sidebarMode,
    toggleSidebarMode,
    contrast,
    setContrast,
    isCustomizerOpen,
    setIsCustomizerOpen,
    resetSettings,
    palette,
  } = useAdminTheme();

  return (
    <>
      {/* Floating Settings Gear Trigger Button */}
      <button
        onClick={() => setIsCustomizerOpen(true)}
        className="fixed top-1/2 right-0 -translate-y-1/2 z-50 p-3 rounded-l-2xl shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:pr-4 group border border-r-0 border-white/20 dark:border-gray-700/50"
        style={{
          background: mode === 'dark' ? 'rgba(22, 28, 36, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          color: palette.primary,
        }}
        title="Customize Theme & Layout"
      >
        <Settings className="w-6 h-6 animate-spin-slow group-hover:rotate-180 transition-transform duration-700" />
      </button>

      {/* Backdrop */}
      {isCustomizerOpen && (
        <div
          onClick={() => setIsCustomizerOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        />
      )}

      {/* Slide-over Customizer Panel */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-80 sm:w-96 shadow-2xl backdrop-blur-xl border-l transition-transform duration-300 flex flex-col ${
          isCustomizerOpen ? 'translate-x-0' : 'translate-x-full'
        } ${
          mode === 'dark'
            ? 'bg-[#161c24]/95 text-gray-100 border-gray-800'
            : 'bg-white/95 text-gray-900 border-gray-200'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: palette.primary }} />
            <h3 className="font-bold text-lg">Theme Customizer</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={resetSettings}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              title="Reset Settings"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsCustomizerOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Mode Switch (Light / Dark) */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Theme Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleMode}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  mode === 'light'
                    ? 'border-2 shadow-md'
                    : 'border-gray-200 dark:border-gray-800 opacity-60 hover:opacity-100'
                }`}
                style={{
                  borderColor: mode === 'light' ? palette.primary : undefined,
                  backgroundColor: mode === 'light' ? palette.primaryLight : undefined,
                }}
              >
                <Sun className="w-6 h-6" style={{ color: mode === 'light' ? palette.primary : undefined }} />
                <span className="text-sm font-semibold">Light</span>
              </button>
              <button
                onClick={toggleMode}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  mode === 'dark'
                    ? 'border-2 shadow-md'
                    : 'border-gray-200 dark:border-gray-800 opacity-60 hover:opacity-100'
                }`}
                style={{
                  borderColor: mode === 'dark' ? palette.primary : undefined,
                  backgroundColor: mode === 'dark' ? palette.primaryLight : undefined,
                }}
              >
                <Moon className="w-6 h-6" style={{ color: mode === 'dark' ? palette.primary : undefined }} />
                <span className="text-sm font-semibold">Dark</span>
              </button>
            </div>
          </div>

          {/* Color Presets */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Color Presets
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(COLOR_PRESETS) as ColorPreset[]).map((key) => {
                const preset = COLOR_PRESETS[key];
                const isSelected = colorPreset === key;
                return (
                  <button
                    key={key}
                    onClick={() => setColorPreset(key)}
                    className={`h-14 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden group ${
                      isSelected
                        ? 'border-2 shadow-lg scale-105'
                        : 'border-gray-200 dark:border-gray-800 hover:scale-102'
                    }`}
                    style={{
                      borderColor: isSelected ? preset.primary : undefined,
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-full shadow-md flex items-center justify-center"
                      style={{ background: preset.accentGradient }}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white font-bold" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nav Sidebar Layout */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Sidebar Layout
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleSidebarMode}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  sidebarMode === 'full'
                    ? 'border-2 shadow-md'
                    : 'border-gray-200 dark:border-gray-800 opacity-60 hover:opacity-100'
                }`}
                style={{
                  borderColor: sidebarMode === 'full' ? palette.primary : undefined,
                  backgroundColor: sidebarMode === 'full' ? palette.primaryLight : undefined,
                }}
              >
                <Layout className="w-6 h-6" style={{ color: sidebarMode === 'full' ? palette.primary : undefined }} />
                <span className="text-sm font-semibold">Full Sidebar</span>
              </button>
              <button
                onClick={toggleSidebarMode}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  sidebarMode === 'mini'
                    ? 'border-2 shadow-md'
                    : 'border-gray-200 dark:border-gray-800 opacity-60 hover:opacity-100'
                }`}
                style={{
                  borderColor: sidebarMode === 'mini' ? palette.primary : undefined,
                  backgroundColor: sidebarMode === 'mini' ? palette.primaryLight : undefined,
                }}
              >
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-6 rounded bg-gray-400" />
                  <div className="w-5 h-6 rounded border border-gray-400 border-dashed" />
                </div>
                <span className="text-sm font-semibold">Mini Sidebar</span>
              </button>
            </div>
          </div>

          {/* Contrast Settings */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Contrast & Depth
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setContrast('default')}
                className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                  contrast === 'default'
                    ? 'border-2'
                    : 'border-gray-200 dark:border-gray-800 text-gray-400'
                }`}
                style={{
                  borderColor: contrast === 'default' ? palette.primary : undefined,
                  color: contrast === 'default' ? palette.primary : undefined,
                }}
              >
                Default
              </button>
              <button
                onClick={() => setContrast('bold')}
                className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                  contrast === 'bold'
                    ? 'border-2'
                    : 'border-gray-200 dark:border-gray-800 text-gray-400'
                }`}
                style={{
                  borderColor: contrast === 'bold' ? palette.primary : undefined,
                  color: contrast === 'bold' ? palette.primary : undefined,
                }}
              >
                High Contrast
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <button
            onClick={() => setIsCustomizerOpen(false)}
            className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: palette.accentGradient }}
          >
            Apply & Close
          </button>
        </div>
      </aside>
    </>
  );
}
