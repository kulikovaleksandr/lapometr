import {
  ActivityDef, DB, IconName, LogEntry, Pet, Species, User, hashPass, uid,
} from "./types";

export const AVATAR_COLORS = [
  "#e8a34e", "#a3c293", "#e8a0ac", "#8fb7c9", "#c9a0dc", "#d9836a", "#7fa8e0", "#c9c26f",
];

export const ACT_COLORS = [
  "#e8a34e", "#7fb3d6", "#c9a06a", "#e39aa6", "#9db98a", "#c9a0dc",
  "#8fb7c9", "#d9b48f", "#d97f6a", "#b3a3e0", "#e07856", "#7fa8e0",
];

export const ACT_ICONS: IconName[] = [
  "feed", "water", "pet", "play", "litter", "brush", "eyes", "ears",
  "nails", "bath", "pill", "syringe", "tooth", "walk", "heart", "paw", "spark", "clock",
];

export const SPECIES: { id: Species; label: string }[] = [
  { id: "cat", label: "Кошка" },
  { id: "dog", label: "Собака" },
  { id: "rabbit", label: "Кролик" },
  { id: "parrot", label: "Попугай" },
  { id: "hamster", label: "Хомяк" },
  { id: "fish", label: "Рыбка" },
];

export const speciesLabel = (s: Species) => SPECIES.find((x) => x.id === s)?.label ?? s;

const A = (
  petId: string, slug: string, title: string, icon: IconName, color: string,
  paws: number, limitDay = 0, limitWeek = 0, limitMonth = 0, remindH = 0,
): ActivityDef => ({
  id: `${petId}_${slug}`, petId, title, icon, color, paws,
  limitDay, limitWeek, limitMonth, remindH,
});

/** Стандартный список активностей по умолчанию */
export function defaultActs(petId: string): ActivityDef[] {
  return [
    A(petId, "feed",   "Покормить",           "feed",    "#e8a34e", 5,  4, 0, 0, 8),
    A(petId, "water",  "Поменять воду",       "water",   "#7fb3d6", 3,  3, 0, 0, 12),
    A(petId, "litter", "Поменять лоток",      "litter",  "#c9a06a", 5,  3, 0, 0, 12),
    A(petId, "pet",    "Погладить",           "pet",     "#e39aa6", 3, 10, 0, 0, 10),
    A(petId, "play",   "Поиграть",            "play",    "#9db98a", 4,  6, 0, 0, 24),
    A(petId, "brush",  "Вычесать",            "brush",   "#c9a0dc", 6,  0, 5, 0, 48),
    A(petId, "eyes",   "Протереть глазки",    "eyes",    "#8fb7c9", 4,  2, 0, 0, 24),
    A(petId, "ears",   "Почистить ушки",      "ears",    "#d9b48f", 5,  0, 3, 0, 72),
    A(petId, "nails",  "Подстричь когти",     "nails",   "#d97f6a", 8,  0, 2, 0, 0),
    A(petId, "pill",   "Таблетка от глистов", "pill",    "#b3a3e0", 12, 0, 0, 1, 720),
    A(petId, "shot",   "Прививка",            "syringe", "#e07856", 15, 0, 0, 1, 0),
    A(petId, "bath",   "Искупать",            "bath",    "#7fa8e0", 10, 0, 1, 0, 0),
  ];
}

/* ---------- демо-данные ---------- */

function mulberry(seed: number) {
  let t = seed;
  return () => {
    t |= 0; t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_EMAIL = "demo@lapometr.app";

export function buildDemoDB(): DB {
  const rnd = mulberry(20240501);
  const now = Date.now();
  const DAY = 86400000;
  const sod = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };

  const u1: User = { id: "u_max", email: DEMO_EMAIL, name: "Максим", pass: hashPass("demo123"), color: "#f2b45a", createdAt: now - 32 * DAY, demo: true };
  const u2: User = { id: "u_ali", email: "alina@lapometr.app", name: "Алина", pass: hashPass("demo123"), color: "#a3c293", createdAt: now - 31 * DAY, demo: true };
  const pet: Pet = {
    id: "pet_bulka", name: "Булка", species: "cat",
    breed: "Британская короткошёрстная", birthday: "2022-05-14",
    color: "#e8a34e", ownerIds: ["u_max", "u_ali"], invite: "BULKA-42", createdAt: now - 31 * DAY,
  };
  const acts = defaultActs(pet.id);
  const logs: LogEntry[] = [];
  const add = (slug: string, owner: string, dayOffset: number, hour: number, min: number) => {
    const at = sod(now - dayOffset * DAY) + hour * 3600e3 + min * 60e3;
    if (at <= now) logs.push({ id: uid(), petId: pet.id, actId: `${pet.id}_${slug}`, ownerId: owner, at });
  };

  for (let d = 29; d >= 0; d--) {
    const j = () => Math.floor(rnd() * 50);
    // Максим — основной ухажёр
    if (rnd() > 0.08) add("feed", "u_max", d, 8, j());
    if (rnd() > 0.15) add("feed", "u_max", d, 13, j());
    if (rnd() > 0.10) add("feed", "u_max", d, 19, j());
    if (rnd() > 0.20) add("water", "u_max", d, 9, j());
    if (rnd() > 0.25) add("water", "u_max", d, 20, j());
    if (rnd() > 0.12) add("litter", "u_max", d, 10, j());
    if (rnd() > 0.30) add("pet", "u_max", d, 12, j());
    if (rnd() > 0.20) add("pet", "u_max", d, 22, j());
    if (rnd() > 0.45) add("play", "u_max", d, 18, j());
    if (rnd() > 0.30) add("eyes", "u_max", d, 9, j());
    // Алина — догоняющая сторона
    if (rnd() > 0.50) add("feed", "u_ali", d, 16, j());
    if (rnd() > 0.45) add("litter", "u_ali", d, 21, j());
    if (rnd() > 0.30) add("pet", "u_ali", d, 17, j());
    if (rnd() > 0.55) add("play", "u_ali", d, 15, j());
    if (d % 2 === 0) add("brush", "u_ali", d, 11, j());
    if (d % 9 === 3) add("ears", "u_ali", d, 12, j());
  }
  add("nails", "u_max", 24, 12, 10);
  add("nails", "u_max", 10, 12, 30);
  add("bath", "u_max", 15, 13, 0);
  add("pill", "u_ali", 26, 10, 0);
  add("shot", "u_max", 29, 15, 30);
  logs.sort((a, b) => a.at - b.at);
  return { v: 1, users: [u1, u2], pets: [pet], acts, logs };
}
