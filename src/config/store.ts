// Загрузка и сохранение конфига: localStorage → иначе default.json.
// Сломанный или устаревший конфиг из localStorage молча заменяется дефолтным.

import defaultJson from "./default.json";
import { validateConfig, type AppConfig } from "./schema";

const KEY = "svoe-zhilyo:config";

// Через unknown: TypeScript выводит из JSON слишком узкие типы; корректность проверяет validateConfig (и тест)
export const defaultConfig = defaultJson as unknown as AppConfig;

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppConfig;
      if (validateConfig(parsed).length === 0) return parsed;
    }
  } catch {
    // localStorage недоступен или JSON битый — берём дефолт
  }
  return structuredClone(defaultConfig);
}

// Сохраняет, только если конфиг корректен; возвращает ошибки
export function saveConfig(config: AppConfig): string[] {
  const errors = validateConfig(config);
  if (errors.length === 0) {
    try {
      localStorage.setItem(KEY, JSON.stringify(config));
    } catch {
      return ["Не удалось сохранить: хранилище браузера недоступно"];
    }
  }
  return errors;
}

export function resetConfig(): AppConfig {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // нечего сбрасывать
  }
  return structuredClone(defaultConfig);
}

export function exportConfig(config: AppConfig): string {
  return JSON.stringify(config, null, 2);
}

// Импорт из текста JSON: либо конфиг, либо список ошибок
export function importConfig(text: string): { config: AppConfig } | { errors: string[] } {
  let parsed: AppConfig;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { errors: ["Файл не похож на JSON"] };
  }
  const errors = validateConfig(parsed);
  return errors.length ? { errors } : { config: parsed };
}
