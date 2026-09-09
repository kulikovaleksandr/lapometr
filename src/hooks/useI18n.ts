import { useState, useCallback } from 'react';
import { getTranslations, getCurrentLanguage, setLanguage, type Language, type Translations } from '../lib/i18n';

export function useI18n() {
  const [language, setLanguageState] = useState<Language>(getCurrentLanguage());
  const [translations, setTranslations] = useState<Translations>(getTranslations(getCurrentLanguage()));

  const changeLanguage = useCallback((newLang: Language) => {
    setLanguage(newLang);
    setLanguageState(newLang);
    setTranslations(getTranslations(newLang));
  }, []);

  return {
    language,
    translations,
    setLanguage: changeLanguage,
  };
}
