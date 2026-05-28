import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeId, Colors, themes } from '../theme';

const THEME_KEY = '@liftbook_theme';

interface ThemeContextType {
  themeId: ThemeId;
  colors: Colors;
  setTheme: (id: ThemeId) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  themeId: 'dark',
  colors: themes.dark.colors,
  setTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(v => {
      if (v && v in themes) setThemeId(v as ThemeId);
    });
  }, []);

  async function setTheme(id: ThemeId) {
    setThemeId(id);
    await AsyncStorage.setItem(THEME_KEY, id);
  }

  return (
    <ThemeContext.Provider value={{ themeId, colors: themes[themeId].colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
