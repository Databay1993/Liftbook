export interface Colors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  accentBg: string;      // transparent accent tint for card backgrounds
  accentBorder: string;  // transparent accent for borders
  danger: string;
  success: string;
}

export type ThemeId = 'dark' | 'energy' | 'chalk';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  emoji: string;
  colors: Colors;
}

export const themes: Record<ThemeId, ThemeDef> = {
  dark: {
    id: 'dark',
    name: 'Dark Gym',
    emoji: '🌑',
    colors: {
      bg: '#0A0A0A',
      surface: '#141414',
      surface2: '#1E1E1E',
      border: '#2A2A2A',
      text: '#F0ECE4',
      muted: '#666666',
      accent: '#3B82F6',
      accent2: '#FF6B35',
      accentBg: 'rgba(59,130,246,0.08)',
      accentBorder: 'rgba(59,130,246,0.22)',
      danger: '#FF4545',
      success: '#4CAF50',
    },
  },
  energy: {
    id: 'energy',
    name: 'Energy',
    emoji: '🔥',
    colors: {
      bg: '#0D0D0D',
      surface: '#1A1A1A',
      surface2: '#222222',
      border: '#2D2D2D',
      text: '#F5F0E8',
      muted: '#666666',
      accent: '#F97316',
      accent2: '#EF4444',
      accentBg: 'rgba(249,115,22,0.08)',
      accentBorder: 'rgba(249,115,22,0.25)',
      danger: '#EF4444',
      success: '#22C55E',
    },
  },
  chalk: {
    id: 'chalk',
    name: 'Chalk',
    emoji: '☀️',
    colors: {
      bg: '#F5F5F0',
      surface: '#FFFFFF',
      surface2: '#EBEBEB',
      border: '#DEDEDE',
      text: '#111111',
      muted: '#888888',
      accent: '#1D4ED8',
      accent2: '#F97316',
      accentBg: 'rgba(29,78,216,0.07)',
      accentBorder: 'rgba(29,78,216,0.22)',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
};

// Backward-compat default export (used during initial load in App.tsx)
export const colors = themes.dark.colors;
