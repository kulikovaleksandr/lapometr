// Утилиты для работы с localStorage
import type { DB } from './types';

const DB_KEY = 'lapometr.db';
const SESSION_KEY = 'lapometr.session';
const THEME_KEY = 'lapometr.theme';

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return createEmptyDB();
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load DB:', e);
    return createEmptyDB();
  }
}

export function saveDB(db: DB): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save DB:', e);
  }
}

export function loadSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function saveSession(userId: string | null): void {
  if (userId) {
    localStorage.setItem(SESSION_KEY, userId);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function loadTheme(): string {
  return localStorage.getItem(THEME_KEY) || 'night';
}

export function saveTheme(theme: string): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function createEmptyDB(): DB {
  return {
    users: [],
    pets: [],
    activities: [],
    logs: [],
    seasonSettings: {},
    monthlyResults: [],
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
