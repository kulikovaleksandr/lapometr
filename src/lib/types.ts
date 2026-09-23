// Основные типы для приложения Лапометр

export type Species = 'cat' | 'dog' | 'rabbit' | 'parrot' | 'hamster' | 'fish';
export type IconName = 'paw' | 'heart' | 'spark' | 'book' | 'trophy' | 'chart' | 'settings' | 'plus' | 'check' | 'x' | 'feed' | 'water' | 'pet' | 'litter' | 'brush' | 'play' | 'eyes' | 'ears' | 'walk' | 'nails' | 'bath' | 'pill' | 'syringe' | 'tooth' | 'bell' | 'flame' | 'users' | 'gear' | 'out' | 'copy' | 'crown' | 'moon' | 'sun' | 'home' | 'camera' | 'edit' | 'trash' | 'clock' | 'info' | 'chev' | 'download' | 'upload' | 'cloud' | 'alert' | 'dot' | 'calendar' | 'stetho' | 'send' | 'repeat' | 'user' | 'globe' | 'share';
export type UserRole = 'owner' | 'helper';
export type ThemeId = 'night' | 'day' | 'latte' | 'forest' | 'olive';
export type VetKind = 'shot' | 'pill' | 'vet' | 'check' | 'other';
export type ExpenseCategory = 'food' | 'litter' | 'vet' | 'toys' | 'accessories' | 'grooming' | 'other';

export interface User {
  id: string;
  email: string;
  name: string;
  color: string;
  avatar?: string;
  img?: string;
  pass?: string;
  cloudId?: string;
  guest?: boolean;
  demo?: boolean;
  createdAt: number;
}

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed: string;
  birthday?: string;
  color: string;
  img?: string;
  createdAt: number;
  ownerIds: string[];
  ownerRoles?: Record<string, UserRole>;
  invite: string;
  seasonSettings?: SeasonSettings;
  monthlyResults?: MonthlyResult[];
}

export interface Activity {
  id: string;
  petId: string;
  title: string;
  paws: number;
  icon: IconName;
  color: string;
  /** Дневной лимит, 0 = без лимита */
  limitDay: number;
  /** Недельный лимит, 0 = без лимита */
  limitWeek: number;
  /** Месячный лимит, 0 = без лимита */
  limitMonth: number;
  /** Интервал напоминания в часах, 0 = выключено */
  remindH: number;
  /** Пользовательская активность (создана хозяином, а не стандартный набор) */
  custom?: boolean;
}

export type ActivityDef = Activity;

export interface LogEntry {
  id: string;
  actId: string;
  ownerId: string;
  petId: string;
  at: number;
  img?: string;
  /** Запись сделана от имени другого хозяина (помощник) */
  onBehalfOf?: string;
}

export interface ChatMessage {
  id: string;
  petId: string;
  authorId: string;
  text: string;
  at: number;
}

export interface VetEvent {
  id: string;
  petId: string;
  kind: VetKind;
  title: string;
  date: string;
  time?: string;
  repeat: 'none' | 'monthly' | 'yearly';
  note?: string;
}

export interface WeightEntry {
  id: string;
  petId: string;
  weight: number;
  date: string;
  note?: string;
}

export interface Expense {
  id: string;
  petId: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description?: string;
  createdAt: number;
}

export interface SeasonSettings {
  enabled: boolean;
  resetDay: number;
}

export interface MonthlyResult {
  petId: string;
  month: string; // YYYY-MM
  winnerId: string | null;
  pawsByUser: Record<string, number>;
  activitiesByUser: Record<string, number>;
  finalizedAt?: number;
  note?: string;
}

export interface TelegramCfg {
  botToken: string;
  chatId: string;
  enabled: boolean;
  remindDue: boolean;
  remindVet: boolean;
}

export interface DB {
  v: number;
  users: User[];
  pets: Pet[];
  /** Активности (определения) питомцев — каноническое поле */
  acts: Activity[];
  logs: LogEntry[];
  chat: ChatMessage[];
  events: VetEvent[];
  weights: WeightEntry[];
  expenses: Expense[];
  telegram?: TelegramCfg;
}

export const SCHEMA_VERSION = 5;

export const THEMES: { id: ThemeId; name: string; bg: string; swatch: string }[] = [
  { id: 'night', name: 'Ночь', bg: '#1a1a1a', swatch: '#f59e0b' },
  { id: 'day', name: 'День', bg: '#faf8f3', swatch: '#f59e0b' },
  { id: 'latte', name: 'Латте', bg: '#f5ebe0', swatch: '#8d6e63' },
  { id: 'forest', name: 'Лес', bg: '#e8f0e3', swatch: '#81c784' },
  { id: 'olive', name: 'Олива', bg: '#f0f0e3', swatch: '#aed581' },
];

export const LEVELS = [
  { at: 0, t: 'Знакомство', emoji: '🐣' },
  { at: 100, t: 'Заботливый', emoji: '🐾' },
  { at: 500, t: 'Опытный', emoji: '⭐' },
  { at: 1000, t: 'Мастер', emoji: '🏆' },
  { at: 5000, t: 'Легенда', emoji: '👑' },
];

export function levelFor(paws: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (paws >= LEVELS[i].at) {
      const current = LEVELS[i];
      const next = LEVELS[i + 1];
      const prog = next ? (paws - current.at) / (next.at - current.at) : 1;
      return { ...current, title: current.t, prog, idx: i, next };
    }
  }
  return { ...LEVELS[0], title: LEVELS[0].t, prog: 0, idx: 0, next: LEVELS[1] };
}

export const uid = () => Math.random().toString(36).substring(2) + Date.now().toString(36);
export const hashPass = (pass: string) => btoa(pass);
export const genInvite = () => Math.random().toString(36).substring(2, 8).toUpperCase();
