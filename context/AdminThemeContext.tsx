"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ColorPreset = 'purple' | 'cyan' | 'blue' | 'orange' | 'red' | 'emerald';
export type SidebarMode = 'full' | 'mini';
export type ContrastMode = 'default' | 'bold';

interface ColorPalette {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  accentGradient: string;
}

export const COLOR_PRESETS: Record<ColorPreset, ColorPalette> = {
  purple: {
    primary: '#7635dc',
    primaryHover: '#5e25b3',
    primaryLight: 'rgba(118, 53, 220, 0.12)',
    accentGradient: 'linear-gradient(135deg, #7635dc 0%, #b179ff 100%)',
  },
  cyan: {
    primary: '#00b8d9',
    primaryHover: '#0097b2',
    primaryLight: 'rgba(0, 184, 217, 0.12)',
    accentGradient: 'linear-gradient(135deg, #00b8d9 0%, #61f3f3 100%)',
  },
  blue: {
    primary: '#2065d1',
    primaryHover: '#103996',
    primaryLight: 'rgba(32, 101, 209, 0.12)',
    accentGradient: 'linear-gradient(135deg, #2065d1 0%, #76adff 100%)',
  },
  orange: {
    primary: '#ffab00',
    primaryHover: '#b77900',
    primaryLight: 'rgba(255, 171, 0, 0.12)',
    accentGradient: 'linear-gradient(135deg, #ffab00 0%, #ffd666 100%)',
  },
  red: {
    primary: '#ff5630',
    primaryHover: '#b71d18',
    primaryLight: 'rgba(255, 86, 48, 0.12)',
    accentGradient: 'linear-gradient(135deg, #ff5630 0%, #ffac82 100%)',
  },
  emerald: {
    primary: '#22c55e',
    primaryHover: '#15803d',
    primaryLight: 'rgba(34, 197, 94, 0.12)',
    accentGradient: 'linear-gradient(135deg, #22c55e 0%, #86efac 100%)',
  },
};

interface AdminThemeContextType {
  mode: ThemeMode;
  toggleMode: () => void;
  colorPreset: ColorPreset;
  setColorPreset: (preset: ColorPreset) => void;
  sidebarMode: SidebarMode;
  toggleSidebarMode: () => void;
  contrast: ContrastMode;
  setContrast: (contrast: ContrastMode) => void;
  palette: ColorPalette;
  isCustomizerOpen: boolean;
  setIsCustomizerOpen: (open: boolean) => void;
  resetSettings: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextType | undefined>(undefined);

export const AdminThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [colorPreset, setColorPreset] = useState<ColorPreset>('purple');
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('full');
  const [contrast, setContrast] = useState<ContrastMode>('default');
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // Read initial theme preference
  useEffect(() => {
    const savedMode = localStorage.getItem('minimal_admin_mode') as ThemeMode;
    const savedColor = localStorage.getItem('minimal_admin_color') as ColorPreset;
    const savedSidebar = localStorage.getItem('minimal_admin_sidebar') as SidebarMode;
    if (savedMode) setMode(savedMode);
    if (savedColor) setColorPreset(savedColor);
    if (savedSidebar) setSidebarMode(savedSidebar);
  }, []);

  // Tailwind's `dark:` variant is configured (globals.css) to key off a `.dark`
  // class rather than OS prefers-color-scheme, so this toggle - not the OS
  // setting - is what actually drives every `dark:` utility class in the admin UI.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  const toggleMode = () => {
    const nextMode = mode === 'light' ? 'dark' : 'light';
    setMode(nextMode);
    localStorage.setItem('minimal_admin_mode', nextMode);
  };

  const changeColorPreset = (preset: ColorPreset) => {
    setColorPreset(preset);
    localStorage.setItem('minimal_admin_color', preset);
  };

  const toggleSidebarMode = () => {
    const nextSidebar = sidebarMode === 'full' ? 'mini' : 'full';
    setSidebarMode(nextSidebar);
    localStorage.setItem('minimal_admin_sidebar', nextSidebar);
  };

  const resetSettings = () => {
    setMode('dark');
    setColorPreset('purple');
    setSidebarMode('full');
    setContrast('default');
    localStorage.removeItem('minimal_admin_mode');
    localStorage.removeItem('minimal_admin_color');
    localStorage.removeItem('minimal_admin_sidebar');
  };

  const palette = COLOR_PRESETS[colorPreset];

  return (
    <AdminThemeContext.Provider
      value={{
        mode,
        toggleMode,
        colorPreset,
        setColorPreset: changeColorPreset,
        sidebarMode,
        toggleSidebarMode,
        contrast,
        setContrast,
        palette,
        isCustomizerOpen,
        setIsCustomizerOpen,
        resetSettings,
      }}
    >
      <div className={mode === 'dark' ? 'dark' : ''} style={{
        '--color-primary': palette.primary,
        '--color-primary-hover': palette.primaryHover,
        '--color-primary-light': palette.primaryLight,
      } as React.CSSProperties}>
        {children}
      </div>
    </AdminThemeContext.Provider>
  );
};

export const useAdminTheme = () => {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error('useAdminTheme must be used within an AdminThemeProvider');
  }
  return context;
};
