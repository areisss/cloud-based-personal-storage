import { createContext, useContext, useEffect, useState } from 'react';

const THEMES = {
  light: {
    bg: '#ffffff',
    bg2: '#fafafa',
    surface: '#ffffff',
    border: '#e5e7eb',
    border2: '#f3f4f6',
    text: '#111827',
    muted: '#6b7280',
    subtle: '#9ca3af',
    accent: '#6366f1',
    navBg: '#0f172a',
    navBorder: '#1e293b',
    navText: '#f8fafc',
    navMuted: '#94a3b8',
    navActive: 'rgba(255,255,255,0.1)',
    inputBg: '#ffffff',
    inputBorder: '#e2e8f0',
    inputText: '#0f172a',
    downloadBg: '#f1f5f9',
    downloadText: '#475569',
    clearBtnBg: '#f1f5f9',
    clearBtnText: '#475569',
    photoTagBg: '#eff6ff',
    photoTagText: '#3b82f6',
    demoBannerBg: '#fefce8',
    demoBannerBorder: '#fde047',
    demoBannerHeading: '#713f12',
    demoBannerBody: '#854d0e',
    sectionHeaderBg: '#f8fafc',
    fileLinkText: '#334155',
    codeBg: '#ffffff',
    codeText: '#6366f1',
    codeBorder: '#e5e7eb',
  },
  dark: {
    bg: '#0f172a',
    bg2: '#111827',
    surface: '#1e293b',
    border: '#334155',
    border2: '#1e293b',
    text: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#64748b',
    accent: '#818cf8',
    navBg: '#09111e',
    navBorder: '#1e293b',
    navText: '#f8fafc',
    navMuted: '#64748b',
    navActive: 'rgba(255,255,255,0.08)',
    inputBg: '#1e293b',
    inputBorder: '#334155',
    inputText: '#f1f5f9',
    downloadBg: '#334155',
    downloadText: '#94a3b8',
    clearBtnBg: '#334155',
    clearBtnText: '#94a3b8',
    photoTagBg: '#1e2a4a',
    photoTagText: '#93c5fd',
    demoBannerBg: '#1c1800',
    demoBannerBorder: '#78350f',
    demoBannerHeading: '#fde68a',
    demoBannerBody: '#fcd34d',
    sectionHeaderBg: '#263244',
    fileLinkText: '#94a3b8',
    codeBg: '#0a0f1e',
    codeText: '#818cf8',
    codeBorder: '#334155',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('theme') === 'dark'; }
    catch { return false; }
  });

  useEffect(() => {
    document.body.style.background = dark ? '#0f172a' : '#ffffff';
    document.body.style.color = dark ? '#f1f5f9' : '#111827';
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); }
    catch {}
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d), t: THEMES[dark ? 'dark' : 'light'] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
