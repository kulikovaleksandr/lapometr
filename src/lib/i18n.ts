// Система интернационализации
export type Language = 'ru' | 'en';

export interface Translations {
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    close: string;
    confirm: string;
    loading: string;
  };
  nav: {
    home: string;
    journal: string;
    duel: string;
    health: string;
    stats: string;
    settings: string;
  };
  home: {
    welcome: string;
    todayActivities: string;
    quickActions: string;
  };
  settings: {
    title: string;
    language: string;
    theme: string;
    notifications: string;
    cloudSync: string;
  };
}

const translations: Record<Language, Translations> = {
  ru: {
    common: {
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      edit: 'Редактировать',
      add: 'Добавить',
      close: 'Закрыть',
      confirm: 'Подтвердить',
      loading: 'Загрузка...',
    },
    nav: {
      home: 'Главная',
      journal: 'Журнал',
      duel: 'Дуэль',
      health: 'Здоровье',
      stats: 'Статистика',
      settings: 'Настройки',
    },
    home: {
      welcome: 'Добро пожаловать!',
      todayActivities: 'Активности на сегодня',
      quickActions: 'Быстрые действия',
    },
    settings: {
      title: 'Настройки',
      language: 'Язык',
      theme: 'Тема',
      notifications: 'Уведомления',
      cloudSync: 'Облачная синхронизация',
    },
  },
  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      close: 'Close',
      confirm: 'Confirm',
      loading: 'Loading...',
    },
    nav: {
      home: 'Home',
      journal: 'Journal',
      duel: 'Duel',
      health: 'Health',
      stats: 'Statistics',
      settings: 'Settings',
    },
    home: {
      welcome: 'Welcome!',
      todayActivities: "Today's Activities",
      quickActions: 'Quick Actions',
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      theme: 'Theme',
      notifications: 'Notifications',
      cloudSync: 'Cloud Sync',
    },
  },
};

export function getTranslations(lang: Language): Translations {
  return translations[lang];
}

export function getCurrentLanguage(): Language {
  const stored = localStorage.getItem('lapometr.language');
  if (stored === 'ru' || stored === 'en') {
    return stored;
  }
  // Определяем язык браузера
  const browserLang = navigator.language.toLowerCase();
  return browserLang.startsWith('ru') ? 'ru' : 'en';
}

export function setLanguage(lang: Language): void {
  localStorage.setItem('lapometr.language', lang);
}
