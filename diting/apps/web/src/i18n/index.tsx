import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { en, type MessageKey } from "./en";
import { zh } from "./zh";

export type Locale = "en" | "zh";
export type { MessageKey };

export type TranslateParams = Record<string, string | number>;
export type Translator = (key: MessageKey, params?: TranslateParams) => string;

const STORAGE_KEY = "titing.locale";
const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, zh };

export function resolveInitialLocale(stored: string | null, browserLanguage: string | undefined): Locale {
  if (stored === "en" || stored === "zh") {
    return stored;
  }
  if (browserLanguage?.toLowerCase().startsWith("zh")) {
    return "zh";
  }
  return "en";
}

export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  const template = dictionaries[locale][key] ?? dictionaries.en[key];
  if (template === undefined) {
    console.warn(`[i18n] missing message key: ${key}`);
    return key;
  }
  return interpolate(template, params);
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name])
  );
}

function safeReadStoredLocale(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeReadBrowserLanguage(): string | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.language;
}

function syncDocumentLang(locale: Locale): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }
}

type I18nContextValue = {
  locale: Locale;
  setLocale(next: Locale): void;
  t: Translator;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider(props: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = resolveInitialLocale(safeReadStoredLocale(), safeReadBrowserLanguage());
    syncDocumentLang(initial);
    return initial;
  });

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 持久化失败（如隐私模式）不影响本次会话切换
    }
    syncDocumentLang(next);
    setLocaleState(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params)
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function toDateLocale(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en-US";
}
