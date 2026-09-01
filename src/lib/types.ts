export type Species = "cat" | "dog" | "rabbit" | "parrot" | "hamster" | "fish";

export type IconName =
  | "feed" | "water" | "pet" | "syringe" | "pill" | "litter" | "brush" | "play"
  | "eyes" | "ears" | "walk" | "nails" | "bath" | "tooth" | "paw" | "heart"
  | "bell" | "trophy" | "flame" | "chart" | "users" | "gear" | "out" | "plus"
  | "check" | "x" | "copy" | "crown" | "moon" | "sun" | "book" | "home"
  | "camera" | "edit" | "trash" | "clock" | "info" | "spark" | "chev"
  | "download" | "upload" | "cloud" | "alert" | "dot";

export interface User {
  id: string;
  email: string;
  name: string;
  pass: string;
  color: string;
  img?: string;
  createdAt: number;
  demo?: boolean;
  guest?: boolean;
}

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
}

export interface ActivityDef {
  id: string;
  petId: string;
  title: string;
  icon: IconName;
  color: string;
  paws: number;
  limitDay: number;   // 0 = без лимита
  limitWeek: number;
  limitMonth: number;
  remindH: number;    // 0 = напоминание выключено
  custom?: boolean;
}

export interface LogEntry {
  id: string;
  petId: string;
  actId: string;
  ownerId: string;
  at: number;
}

export interface DB {
  v: number;
  users: User[];
  pets: Pet[];
  acts: ActivityDef[];
  logs: LogEntry[];
}

export type ThemeId = "night" | "day" | "latte" | "forest" | "olive";

export const THEMES: { id: ThemeId; name: string; swatch: string; bg: string; dark: boolean }[] = [
  { id: "night",  name: "Ночь",   swatch: "#f2b45a", bg: "#211a14", dark: true },
  { id: "day",    name: "День",   swatch: "#d98a2b", bg: "#f4f0e7", dark: false },
  { id: "latte",  name: "Латте",  swatch: "#b06a28", bg: "#e9d8bf", dark: false },
  { id: "forest", name: "Лес",    swatch: "#4f8a3d", bg: "#e7eedd", dark: false },
  { id: "olive",  name: "Олива",  swatch: "#cdd671", bg: "#2b2d20", dark: true },
];

export const LEVELS = [
  { at: 0,    t: "Знакомство" },
  { at: 150,  t: "Заботливый хвост" },
  { at: 400,  t: "Хранитель миски" },
  { at: 900,  t: "Укротитель когтей" },
  { at: 1800, t: "Шёпот усов" },
  { at: 3200, t: "Лапа-легенда" },
];

export function levelFor(paws: number) {
  let idx = 0;
  for (let k = 0; k < LEVELS.length; k++) if (paws >= LEVELS[k].at) idx = k;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const prog = next ? Math.min(1, (paws - cur.at) / (next.at - cur.at)) : 1;
  return { idx, title: cur.t, next, prog };
}

export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const hashPass = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return "h" + h.toString(36);
};

export function genInvite(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return `PAW-${s}`;
}
