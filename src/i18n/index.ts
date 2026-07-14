import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

// The key used to persist the user's chosen language in SecureStore
export const LANGUAGE_STORAGE_KEY = 'app_language';

// Supported languages
export type SupportedLanguage = 'en' | 'ar';
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'ar'];

// Translation resources
const resources = {
  en: { translation: en },
  ar: { translation: ar },
};

/**
 * Detects the best initial language:
 * 1. Falls back to device locale if it's a supported language
 * 2. Falls back to 'en'
 * Note: The persisted language override is applied in LanguageContext after init.
 */
export function detectDeviceLanguage(): SupportedLanguage {
  const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
  if (SUPPORTED_LANGUAGES.includes(deviceLocale as SupportedLanguage)) {
    return deviceLocale as SupportedLanguage;
  }
  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectDeviceLanguage(),
    fallbackLng: 'en',
    // compatibilityJSON: 'v4' belongs in CustomTypeOptions augmentation, not InitOptions
    interpolation: {
      // React already escapes values — no need for i18next to do it
      escapeValue: false,
    },
  });

export default i18n;
