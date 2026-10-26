// Конфиг в React: один провайдер на всё приложение.
// Модули читают конфиг через useConfig(); админка меняет его через update() —
// изменения сразу видны во всех модулях и сохраняются в localStorage.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { globalLabels, globalValues, type AppConfig } from "./schema";
import { loadConfig, resetConfig, saveConfig } from "./store";

type ConfigContextValue = {
  config: AppConfig;
  globals: Record<string, number>; // значения глобальных параметров по id
  labels: Record<string, string>; // их подписи
  update: (next: AppConfig) => string[]; // ошибки валидации; пусто — сохранено
  reset: () => void;
};

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(loadConfig);

  const value = useMemo<ConfigContextValue>(
    () => ({
      config,
      globals: globalValues(config),
      labels: globalLabels(config),
      update: (next) => {
        const errors = saveConfig(next);
        if (errors.length === 0) setConfig(next);
        return errors;
      },
      reset: () => setConfig(resetConfig()),
    }),
    [config],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig вызван вне ConfigProvider");
  return ctx;
}
