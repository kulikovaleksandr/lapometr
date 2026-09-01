import {
  ActivityDef, DB, LogEntry, Pet, ThemeId, User, hashPass, uid,
} from "./types";
import { AVATAR_COLORS, buildDemoDB, defaultActs, DEMO_EMAIL } from "./data";

const DB_KEY = "lapometr.db.v1";
const SES_KEY = "lapometr.session.v1";
const THEME_KEY = "lapometr.theme.v1";
const NOTIF_KEY = "lapometr.notif.v1";

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db && Array.isArray(db.users) && Array.isArray(db.logs)) return db;
    }
  } catch { /* повреждённые данные — начинаем заново */ }
  return { v: 1, users: [], pets: [], acts: [], logs: [] };
}

export function saveDB(db: DB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  window.dispatchEvent(new CustomEvent("lapometr:db"));
}

/* Сессия — на вкладку (sessionStorage): два хозяина могут сидеть в соседних вкладках */
export const loadSession = () => sessionStorage.getItem(SES_KEY);
export const saveSession = (id: string | null) => {
  if (id) sessionStorage.setItem(SES_KEY, id);
  else sessionStorage.removeItem(SES_KEY);
};

export function loadTheme(): ThemeId {
  const t = localStorage.getItem(THEME_KEY);
  return t === "day" || t === "latte" || t === "forest" || t === "olive" ? t : "night";
}
export const saveTheme = (t: ThemeId) => localStorage.setItem(THEME_KEY, t);
export const loadNotif = () => localStorage.getItem(NOTIF_KEY) === "1";
export const saveNotif = (v: boolean) => localStorage.setItem(NOTIF_KEY, v ? "1" : "0");

/* ================= даты ================= */
export const DAY = 86400000;
export const HOUR = 3600e3;
export const MIN = 60e3;

export const startOfDay = (ts: number) => {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
};
export const startOfWeek = (ts: number) => {
  const wd = (new Date(ts).getDay() + 6) % 7; // понедельник = 0
  return startOfDay(ts) - wd * DAY;
};
export const startOfMonth = (ts: number) => {
  const d = new Date(ts); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime();
};

const M = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const fmtTime = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const fmtDate = (ts: number) => `${new Date(ts).getDate()} ${M[new Date(ts).getMonth()]}`;
export const fmtDateFull = (ts: number) => {
  const d = new Date(ts);
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
};
export function dayLabel(ts: number, now = Date.now()) {
  const s = startOfDay(ts);
  if (s === startOfDay(now)) return "Сегодня";
  if (s === startOfDay(now - DAY)) return "Вчера";
  return fmtDate(ts);
}
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export function agoText(ts: number, now = Date.now()) {
  const m = Math.round((now - ts) / MIN);
  if (m < 1) return "только что";
  if (m < 60) return `${m} ${plural(m, "минуту", "минуты", "минут")} назад`;
  const h = Math.floor(m / 60);
  if (h < 24 && startOfDay(ts) === startOfDay(now))
    return `${h} ${plural(h, "час", "часа", "часов")} назад`;
  if (startOfDay(ts) === startOfDay(now - DAY)) return "вчера";
  return fmtDate(ts);
}
export function ageText(birthday: string, now = Date.now()) {
  if (!birthday) return "";
  const b = new Date(birthday + "T00:00:00").getTime();
  if (Number.isNaN(b) || b > now) return "";
  let months = Math.floor((now - b) / (DAY * 30.44));
  const y = Math.floor(months / 12); months %= 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${plural(y, "год", "года", "лет")}`);
  if (months > 0 && y < 3) parts.push(`${months} мес.`);
  return parts.length ? parts.join(" ") : "меньше месяца";
}
export function durText(min: number) {
  if (min < 1) return "сейчас";
  if (min < 60) return `${Math.round(min)} мин`;
  const h = Math.floor(min / 60), rm = Math.round(min % 60);
  if (h < 24) return rm > 0 && h < 10 ? `${h} ч ${rm} мин` : `${h} ч`;
  const d = Math.floor(h / 24), rh = h % 24;
  return rh > 0 ? `${d} ${plural(d, "день", "дня", "дней")} ${rh} ч` : `${d} ${plural(d, "день", "дня", "дней")}`;
}
export const fmtNum = (n: number) => n.toLocaleString("ru-RU");

/* ================= домен ================= */
export interface LimitInfo { used: number; max: number }
export interface LimitsState {
  day: LimitInfo | null; week: LimitInfo | null; month: LimitInfo | null;
  blocked: string | null;
}
export function limitsFor(act: ActivityDef, logs: LogEntry[], now: number): LimitsState {
  const mine = logs.filter((l) => l.actId === act.id);
  const day = act.limitDay > 0 ? { used: mine.filter((l) => l.at >= startOfDay(now)).length, max: act.limitDay } : null;
  const week = act.limitWeek > 0 ? { used: mine.filter((l) => l.at >= startOfWeek(now)).length, max: act.limitWeek } : null;
  const month = act.limitMonth > 0 ? { used: mine.filter((l) => l.at >= startOfMonth(now)).length, max: act.limitMonth } : null;
  let blocked: string | null = null;
  if (day && day.used >= day.max) blocked = `Дневной лимит (${day.max}/день) исчерпан`;
  else if (week && week.used >= week.max) blocked = `Недельный лимит (${week.max}/нед) исчерпан`;
  else if (month && month.used >= month.max) blocked = `Месячный лимит (${month.max}/мес) исчерпан`;
  return { day, week, month, blocked };
}

export const lastLog = (logs: LogEntry[], actId: string) => {
  let r: LogEntry | undefined;
  for (const l of logs) if (l.actId === actId && (!r || l.at > r.at)) r = l;
  return r;
};

export interface DueItem {
  act: ActivityDef;
  last: LogEntry | undefined;
  dueAt: number | null;
  overdueMin: number | null; // null = ещё ни разу не выполнялось
}
export function computeDue(acts: ActivityDef[], logs: LogEntry[], now: number): DueItem[] {
  return acts
    .filter((a) => a.remindH > 0)
    .map((a) => {
      const l = lastLog(logs, a.id);
      if (!l) return { act: a, last: undefined, dueAt: null, overdueMin: null };
      const dueAt = l.at + a.remindH * HOUR;
      return { act: a, last: l, dueAt, overdueMin: (now - dueAt) / MIN };
    })
    .sort((a, b) => (b.overdueMin ?? Number.POSITIVE_INFINITY) - (a.overdueMin ?? Number.POSITIVE_INFINITY));
}

export const pawsOf = (acts: ActivityDef[], logs: LogEntry[]) => {
  const m = new Map(acts.map((a) => [a.id, a.paws]));
  return logs.reduce((s, l) => s + (m.get(l.actId) ?? 0), 0);
};

function daySet(logs: LogEntry[], ownerId?: string) {
  const s = new Set<number>();
  for (const l of logs) if (!ownerId || l.ownerId === ownerId) s.add(startOfDay(l.at));
  return s;
}
export function streakDays(logs: LogEntry[], now: number, ownerId?: string) {
  const s = daySet(logs, ownerId);
  if (!s.size) return 0;
  let cur = startOfDay(now);
  if (!s.has(cur)) cur -= DAY;
  let n = 0;
  while (s.has(cur)) { n++; cur -= DAY; }
  return n;
}
export function bestStreak(logs: LogEntry[], ownerId?: string) {
  const s = [...daySet(logs, ownerId)].sort((a, b) => a - b);
  let best = 0, run = 0, prev = 0;
  for (const d of s) { run = prev && d - prev === DAY ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

/* ================= аккаунты ================= */
function pickColor(db: DB) {
  const used = new Set(db.users.map((u) => u.color));
  for (const c of AVATAR_COLORS) if (!used.has(c)) return c;
  return AVATAR_COLORS[db.users.length % AVATAR_COLORS.length];
}

export function registerUser(db: DB, email: string, pass: string, name: string):
  { db: DB; user: User } | { error: string } {
  const em = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(em)) return { error: "Похоже, это не e-mail" };
  if (pass.length < 4) return { error: "Пароль — минимум 4 символа" };
  if (db.users.some((u) => u.email === em)) return { error: "Такой e-mail уже зарегистрирован" };
  const user: User = {
    id: uid(), email: em, name: name.trim() || "Хозяин",
    pass: hashPass(pass), color: pickColor(db), createdAt: Date.now(),
  };
  return { db: { ...db, users: [...db.users, user] }, user };
}

export function loginUser(db: DB, email: string, pass: string):
  { user: User } | { error: string } {
  const u = db.users.find((x) => x.email === email.trim().toLowerCase());
  if (!u) return { error: "Аккаунт с таким e-mail не найден" };
  if (u.pass !== hashPass(pass)) return { error: "Неверный пароль" };
  return { user: u };
}

export function makeGuest(db: DB): { db: DB; user: User } {
  const n = db.users.filter((u) => u.guest).length + 1;
  const user: User = {
    id: uid(), email: `guest${n}@local`, name: `Гость ${n}`,
    pass: "", color: pickColor(db), createdAt: Date.now(), guest: true,
  };
  return { db: { ...db, users: [...db.users, user] }, user };
}

export function ensureDemo(existing: DB): { db: DB; user: User } {
  const found = existing.users.find((u) => u.email === DEMO_EMAIL);
  if (found) return { db: existing, user: found };
  const demo = buildDemoDB();
  const db: DB = {
    v: 1,
    users: [...existing.users, ...demo.users],
    pets: [...existing.pets, ...demo.pets],
    acts: [...existing.acts, ...demo.acts],
    logs: [...existing.logs, ...demo.logs],
  };
  return { db, user: demo.users[0] };
}

export function makePetWithActs(pet: Pet): { pet: Pet; acts: ActivityDef[] } {
  return { pet, acts: defaultActs(pet.id) };
}

export function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("not-image")); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 256;
      const c = document.createElement("canvas");
      c.width = size; c.height = size;
      const ctx = c.getContext("2d")!;
      const m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad-image")); };
    img.src = url;
  });
}
