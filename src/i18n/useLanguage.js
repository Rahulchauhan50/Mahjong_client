import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSavedLanguage, saveLanguage, translateKey, translateText } from './translations.js';

export function useLanguage() {
  const [language, setLanguageState] = useState(() => getSavedLanguage());

  useEffect(() => {
    const handleLanguageChange = (event) => {
      setLanguageState(event.detail || getSavedLanguage());
    };

    const handleStorage = (event) => {
      if (!event.key || event.key === 'sakura-mahjong-language') {
        setLanguageState(getSavedLanguage());
      }
    };

    window.addEventListener('sakura-language-change', handleLanguageChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('sakura-language-change', handleLanguageChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setLanguage = useCallback((nextLanguage) => {
    saveLanguage(nextLanguage);
    setLanguageState(nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    const nextLanguage = language === 'en' ? 'zh' : 'en';
    saveLanguage(nextLanguage);
    setLanguageState(nextLanguage);
  }, [language]);

  return useMemo(() => ({
    language,
    isChinese: language === 'zh',
    setLanguage,
    toggleLanguage,
    t: (key) => translateKey(language, key),
    tx: (value) => translateText(language, value),
  }), [language, setLanguage, toggleLanguage]);
}
