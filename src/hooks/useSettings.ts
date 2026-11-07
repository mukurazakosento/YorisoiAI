import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { scaledSize } from '../constants/typography';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
} from '../types/settings';
import { loadSettings, saveSettings } from '../utils/settingsStorage';

type SettingsContextValue = {
  settings: AppSettings;
  isReady: boolean;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  fontSize: (base: number) => number;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadSettings().then((loaded) => {
      if (!active) {
        return;
      }
      setSettings(loaded);
      setIsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  const fontSize = useCallback(
    (base: number) => scaledSize(base, settings.fontScale),
    [settings.fontScale],
  );

  const value = useMemo(
    () => ({ settings, isReady, updateSettings, fontSize }),
    [settings, isReady, updateSettings, fontSize],
  );

  return createElement(SettingsContext.Provider, { value }, children);
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings は SettingsProvider の内側で使ってください。');
  }
  return value;
}
