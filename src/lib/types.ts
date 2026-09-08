export type Species = "cat" | "dog" | "rabbit" | "parrot" | "hamster" | "fish";

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
  note?: string; // пометка для краевых случаев
}

// Утилиты
export const uid = () => Math.random().toString(36).substring(2, 15);
export const hashPass = (pass: string) => btoa(pass);
export const genInvite = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// Типы иконок
export type IconName = 
  | "feed" | "water" | "pet" | "syringe" | "pill" | "litter" | "brush" | "play"
  | "eyes" | "ears" | "walk" | "nails" | "bath" | "tooth" | "paw" | "heart"
  | "bell" | "trophy" | "flame" | "chart" | "users" | "gear" | "out" | "plus"
  | "check" | "x" | "copy" | "crown" | "moon" | "sun" | "book" | "home"
  | "camera" | "edit" | "trash" | "clock" | "info" | "spark" | "chev"
  | "download" | "upload" | "cloud" | "alert" | "dot"
  | "calendar" | "stetho" | "send" | "repeat" | "user" | "globe" | "share";

// Определения активностей
export interface ActivityDef {
  id: string;
  petId: string;
  title: string;
  icon: IconName;
  color: string;
  paws: number;
  limitDay: number;
  limitWeek: number;
  limitMonth: number;
  remindH: number;
  custom?: boolean;
}

// Чат
export interface ChatMessage {
  id: string;
  petId: string;
  authorId: string;
  text: string;
  at: number;
}

// Ветеринарные события
export type VetKind = "shot" | "pill" | "vet" | "check" | "other";
export interface VetEvent {
  id: string;
  petId: string;
  kind: VetKind;
  title: string;
  date: string;
  time?: string;
  repeat: "none" | "monthly" | "yearly";
  note?: string;
}

// Вес
export interface WeightEntry {
  id: string;
  petId: string;
  weight: number;
  date: string;
  note?: string;
}

// Расходы
export type ExpenseCategory = "food" | "litter" | "vet" | "toys" | "accessories" | "grooming" | "other";
export interface Expense {
  id: string;
  petId: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description?: string;
  createdAt: number;
}

// Telegram
export interface TelegramCfg {
  botToken: string;
  chatId: string;
  enabled: boolean;
  remindDue: boolean;
  remindVet: boolean;
}

// Темы
export type ThemeId = "night" | "day" | "latte" | "forest" | "olive";
export const THEMES: { id: ThemeId; name: string; bg: string }[] = [
  { id: "night", name: "Ночь", bg: "#211a14" },
  { id: "day", name: "День", bg: "#faf8f3" },
  { id: "latte", name: "Латте", bg: "#f5ebe0" },
  { id: "forest", name: "Лес", bg: "#e8f0e3" },
  { id: "olive", name: "Олива", bg: "#f0f0e3" },
];

// Уровни
export const LEVELS = [
  { min: 0, title: "Знакомство", emoji: "🐣" },
  { min: 100, title: "Заботливый", emoji: "🐾" },
  { min: 500, title: "Опытный", emoji: "⭐" },
  { min: 1000, title: "Мастер", emoji: "🏆" },
  { min: 5000, title: "Легенда", emoji: "👑" },
];

export const levelFor = (paws: number) => {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (paws >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
};

// Расширенный User
export interface User {
  id: string;
  email: string;
  name: string;
  pass: string;
  color: string;
  img?: string;
  createdAt: number;
  cloudId?: string;
  guest?: boolean;
  demo?: boolean;
}

// Расширенный Pet
export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed: string;
  birthday: string;
  color: string;
  img?: string;
  ownerIds: string[];
  invite: string;
  createdAt: number;
  seasonSettings?: SeasonSettings;
  monthlyResults?: MonthlyResult[];
}

// Расширенный LogEntry
export interface LogEntry {
  id: string;
  petId: string;
  actId: string;
  ownerId: string;
  at: number;
  img?: string;
  onBehalfOf?: string;
}

export const SCHEMA_VERSION = 5;

// База данных
export interface DB {
  v: number;
  users: User[];
  pets: Pet[];
  acts: ActivityDef[];
  logs: LogEntry[];
  chat: ChatMessage[];
  events: VetEvent[];
  weights?: WeightEntry[];
  expenses?: Expense[];
}
