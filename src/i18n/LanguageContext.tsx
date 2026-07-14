import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Alert, DevSettings, I18nManager, Platform } from 'react-native';
import i18n, {
  detectDeviceLanguage,
  LANGUAGE_STORAGE_KEY,
  type SupportedLanguage,
} from './index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LanguageContextValue {
  /** The currently active language code, e.g. 'en' or 'ar' */
  language: SupportedLanguage;
  /** True when Arabic (or any RTL language) is active */
  isRTL: boolean;
  /** True while the initial persisted language is being read from SecureStore */
  isLoadingLanguage: boolean;
  /**
   * Change the app language.
   * When the RTL direction changes (en ↔ ar) the app will show an alert
   * and reload so the native layout engine can re-render with the new direction.
   */
  changeLanguage: (lang: SupportedLanguage) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  isRTL: false,
  isLoadingLanguage: true,
  changeLanguage: async () => {},
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reloads the app to apply a native RTL/LTR direction change.
 * Uses DevSettings (available in Expo Go / development builds).
 * For production builds with expo-updates, replace with Updates.reloadAsync().
 */
function reloadApp() {
  if (Platform.OS === 'web') return; // Web doesn't need a reload for RTL
  // DevSettings.reload() is available in both development and production RN bundles
  DevSettings.reload();
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [isRTL, setIsRTL] = useState(false);
  const [isLoadingLanguage, setIsLoadingLanguage] = useState(true);

  // Allow RTL globally (must be set before any layout happens)
  useEffect(() => {
    I18nManager.allowRTL(true);
  }, []);

  // On mount: read persisted language from SecureStore, then sync i18n + RTL
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
        const resolvedLang: SupportedLanguage =
          (stored as SupportedLanguage | null) ?? detectDeviceLanguage();

        // Sync i18next without triggering a reload (first paint)
        await i18n.changeLanguage(resolvedLang);

        const rtl = resolvedLang === 'ar';
        setLanguage(resolvedLang);
        setIsRTL(rtl);

        // If stored RTL preference doesn't match current native setting,
        // force-set it (handles the case right after an in-app reload)
        if (I18nManager.isRTL !== rtl) {
          I18nManager.forceRTL(rtl);
        }
      } catch (e) {
        console.warn('[i18n] Failed to restore language:', e);
      } finally {
        setIsLoadingLanguage(false);
      }
    })();
  }, []);

  // -------------------------------------------------------------------------
  // changeLanguage
  // -------------------------------------------------------------------------

  const changeLanguage = useCallback(
    async (lang: SupportedLanguage) => {
      if (lang === language) return;

      const willChangeRTL = (lang === 'ar') !== isRTL;

      // Persist choice first so it survives the reload
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, lang);

      if (willChangeRTL) {
        // RTL direction change requires a native app reload.
        // Show an alert so the user isn't surprised.
        Alert.alert(
          lang === 'ar' ? 'تغيير اللغة' : 'Switching Language',
          lang === 'ar'
            ? 'سيتم إعادة تشغيل التطبيق لتطبيق اتجاه اللغة الجديد.'
            : 'The app will reload to apply the new language direction.',
          [
            {
              text: lang === 'ar' ? 'إعادة التشغيل الآن' : 'Reload Now',
              onPress: () => {
                // Apply the RTL flag before reloading
                I18nManager.forceRTL(lang === 'ar');
                reloadApp();
              },
            },
            {
              text: lang === 'ar' ? 'إلغاء' : 'Cancel',
              style: 'cancel',
              onPress: async () => {
                // Revert the stored value since the user cancelled
                await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, language);
              },
            },
          ]
        );
      } else {
        // Same RTL direction — no reload needed, just swap translations.
        await i18n.changeLanguage(lang);
        setLanguage(lang);
        setIsRTL(lang === 'ar');
      }
    },
    [language, isRTL]
  );

  return (
    <LanguageContext.Provider
      value={{ language, isRTL, isLoadingLanguage, changeLanguage }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside <LanguageProvider>');
  }
  return ctx;
}

export { LanguageContext };
