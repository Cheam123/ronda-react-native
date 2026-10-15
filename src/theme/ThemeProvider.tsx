import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ronda.theme';

interface ThemeContextValue {
  colors: Palette;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: light,
  preference: 'system',
  setPreference: () => {},
});

/** Light, Dark or System (the default), remembered on this phone. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const scheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setPreferenceState(saved);
          Appearance.setColorScheme(saved === 'system' ? 'unspecified' : saved);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    // Native pickers and alerts follow the app, not only our own views.
    Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => {
    const isDark = preference === 'system' ? scheme === 'dark' : preference === 'dark';
    return { colors: isDark ? dark : light, preference, setPreference };
  }, [preference, scheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;
