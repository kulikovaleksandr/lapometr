/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import type {
  ActivityDef, DB, LogEntry, MonthlyResult, Pet, SeasonSettings, TelegramCfg, ThemeId, User, VetEvent,
} from "../lib/types";
import { genInvite, uid } from "../lib/types";
import {
  HOUR, computeDue, ensureDemo, limitsFor, loadActivePet, loadDB, loadNotif, loadSession,
  loadTelegram, loadTheme, loginUser, makeGuest, makePetWithActs, plural, registerUser, saveActivePet, saveDB,
  saveNotif, saveSession, saveTelegram, saveTheme, startOfDay,
} from "../lib/db";
import { generateVetEventsForPet } from "../lib/vet-schedule";
import { tgSend } from "../lib/telegram";
import {
  cloudClaimInvite, cloudCurrentUser, cloudFetchPetBundle, cloudFullPush, cloudPull, cloudRowFetch,
  cloudTouchAccess, cloudUploadPhoto, computeDivergence, divergenceTotal, flushOutbox, loadCloudConfig,
  mergeRemoteRows, outboxCount, sanitizeForCloud, subscribeRealtime,
  type CloudUser, type Divergence, type RtStatus,
} from "../lib/cloud";
import {
  getSeasonActivitiesByUser, getSeasonInfo, getSeasonLogs, getSeasonPawsByUser, getSeasonWinner,
  getYearlyChampion,
} from "../lib/seasons";
import { trackActivityComplete, trackPetCreated } from "../lib/monitoring";
import { toast as uiToast } from "../components/ui";

/** Входные данные формы вет-календаря (см. screens/Vet.tsx) */
export interface VetInput {
  title: string;
  kind: VetEvent["kind"];
  date: string;
  time?: string;
  repeat: VetEvent["repeat"];
  note?: string;
}

/** Данные шага онбординга «Питомец» (см. components/PetForm.tsx) */
export interface CreatePetData {
  name: string;
  species: Pet["species"];
  breed: string;
  birthday: string;
  color: string;
  img?: string;
}

type ToastType = "ok" | "err" | "info" | "warn";
type Role = "owner" | "helper";

export interface AppCtx {
  db: DB;
  user: User | null;
  pet: Pet | null;
  users: User[];
  pets: Pet[];
  userPets: Pet[];
  owners: User[];
  acts: ActivityDef[];
  logs: LogEntry[];
  events: VetEvent[];
  chat: any[];
  weights: any[];
  expenses: any[];
  monthlyResults: MonthlyResult[];
  now: number;
  theme: ThemeId;
  notifOn: boolean;
  tg: TelegramCfg;
  cloudUser: CloudUser | null;
  rtStatus: RtStatus;
  outboxN: number;
  seasonInfo: ReturnType<typeof getSeasonInfo>;
  seasonPawsByUser: Record<string, number>;
  seasonActivitiesByUser: Record<string, number>;
  seasonLogs: LogEntry[];
  seasonWinner: string | null;
  yearlyChampion: string | null;
  /* аккаунты */
  login: (email: string, pass: string) => Promise<string | null>;
  register: (email: string, pass: string, name: string) => Promise<string | null>;
  loginDemo: () => void;
  guest: () => void;
  logout: () => void;
  updateProfile: (patch: Partial<User>) => void;
  /* питомцы */
  createPet: (data: CreatePetData) => void;
  setActivePet: (id: string) => void;
  regenInvite: () => void;
  joinPet: (code: string) => Promise<string | null>;
  removeOwner: (ownerId: string) => string | null;
  getUserRole: (userId: string) => Role;
  setUserRole: (userId: string, role: Role) => void;
  canEditActivities: () => boolean;
  /* активности */
  addAct: (v: Omit<ActivityDef, "id" | "petId"> & { petId?: string }) => string | null;
  updateAct: (id: string, patch: Partial<ActivityDef>) => void;
  deleteAct: (id: string) => void;
  complete: (actId: string, img?: string, onBehalfOf?: string) => void;
  /* чат */
  sendMessage: (text: string) => void;
  /* вет-календарь */
  addEvent: (input: VetInput) => string | null;
  updateEvent: (id: string, patch: Partial<VetEvent>) => void;
  deleteEvent: (id: string) => void;
  regenerateVetSchedule: () => void;
  /* вес и расходы */
  addWeight: (w: { weight: number; date: string; note?: string }) => string | null;
  deleteWeight: (id: string) => void;
  addExpense: (e: any) => string | null;
  updateExpense: (id: string, patch: Partial<any>) => void;
  deleteExpense: (id: string) => void;
  /* настройки */
  setTheme: (t: ThemeId) => void;
  toggleNotif: () => void;
  setTg: (patch: Partial<TelegramCfg>) => void;
  exportData: () => void;
  resetAll: () => void;
  replaceDb: (db: DB) => void;
  toast: (msg: string, type?: ToastType) => void;
  /* сезоны */
  updateSeasonSettings: (patch: Partial<SeasonSettings>) => void;
  finalizeCurrentMonth: () => void;
  /* облако */
  syncFromCloud: () => Promise<boolean>;
  pushToCloud: () => Promise<boolean>;
  fetchDivergence: () => Promise<Divergence | null>;
  applyMerge: () => Promise<void>;
  flushOutboxNow: () => Promise<number>;
}

const Ctx = createContext<AppCtx | null>(null);

export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
};

/** Живое «сейчас»: тик раз в минуту — лимиты и напоминания пересчитываются сами */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const isoMonth = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const NO_PET_SEASON = { enabled: false, start: 0, end: 0, daysLeft: 0, isLastDay: false };

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => loadDB());
  const [uidCur, setUidCur] = useState<string | null>(() => loadSession());
  const [activePetId, setActivePetId] = useState<string | null>(() => loadActivePet());
  const [theme, setTheme_] = useState<ThemeId>(() => loadTheme());
  const [notifOn, setNotifOn] = useState<boolean>(() => loadNotif());
  const [tg, setTg_] = useState<TelegramCfg>(() => loadTelegram());
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [rtStatus, setRtStatus] = useState<RtStatus>("off");
  const [outboxN, setOutboxN] = useState<number>(() => outboxCount());
  const now = useNow();

  /* ---- ref-«линза» на текущее состояние (для обработчиков событий/интервалов) ---- */
  const ref = useRef({ db, user: null as User | null });
  const user = db.users.find((u) => u.id === uidCur) ?? null;
  ref.current = { db, user };

  /* ---- сохранение БД + синхронизация между вкладками/экземплярами провайдера ---- */
  const firstRender = useRef(true);
  useEffect(() => {
    // на первом рендере НЕ сохраняем: иначе экземпляр с устаревшим снимком БД
    // затрёт изменения, сделанные другим экземпляром провайдера
    if (firstRender.current) { firstRender.current = false; return; }
    saveDB(db);
  }, [db]);
  useEffect(() => {
    const h = () => {
      const fresh = loadDB();
      if (fresh) setDb((cur) => (JSON.stringify(cur) === JSON.stringify(fresh) ? cur : fresh));
    };
    window.addEventListener("storage", h);
    window.addEventListener("lapometr:db", h);
    return () => {
      window.removeEventListener("storage", h);
      window.removeEventListener("lapometr:db", h);
    };
  }, []);

  /* ---- тема: data-theme на <html> ---- */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => { saveNotif(notifOn); }, [notifOn]);

  /* ---- активный питомец: валидация и persist ---- */
  const userPets = useMemo(
    () => (user ? db.pets.filter((p) => p.ownerIds.includes(user.id)) : []),
    [db.pets, user],
  );
  useEffect(() => {
    if (userPets.length && !userPets.some((p) => p.id === activePetId)) {
      setActivePetId(userPets[0].id);
    }
  }, [userPets, activePetId]);
  useEffect(() => { saveActivePet(activePetId); }, [activePetId]);
  const pet = userPets.find((p) => p.id === activePetId) ?? null;

  /* ---- производные данные текущего питомца ---- */
  const acts = useMemo(() => (pet ? db.acts.filter((a) => a.petId === pet.id) : []), [db.acts, pet]);
  const logs = useMemo(() => (pet ? db.logs.filter((l) => l.petId === pet.id) : []), [db.logs, pet]);
  const events = useMemo(() => (pet ? db.events.filter((e) => e.petId === pet.id) : []), [db.events, pet]);
  const owners = useMemo(
    () => (pet ? pet.ownerIds.map((id) => db.users.find((u) => u.id === id)).filter(Boolean) as User[] : []),
    [db.users, pet],
  );
  const chat = useMemo(() => (pet ? (db.chat ?? []).filter((m) => m.petId === pet.id) : []), [db.chat, pet]);
  const weights = useMemo(() => (pet ? (db.weights ?? []).filter((w) => w.petId === pet.id) : []), [db.weights, pet]);
  const expenses = useMemo(() => (pet ? (db.expenses ?? []).filter((e) => e.petId === pet.id) : []), [db.expenses, pet]);

  /* ---- сезоны ---- */
  const seasonSettings: SeasonSettings = pet?.seasonSettings ?? { enabled: false, resetDay: 1 };
  const seasonInfo = useMemo(
    () => (pet ? getSeasonInfo(pet, seasonSettings, now) : NO_PET_SEASON),
    [pet, seasonSettings.enabled, seasonSettings.resetDay, now],
  );
  const seasonLogs = useMemo(
    () => (pet ? getSeasonLogs(db.logs, pet, seasonSettings, now) : []),
    [db.logs, pet, seasonSettings.enabled, seasonSettings.resetDay, now],
  );
  const seasonPawsByUser = useMemo(
    () => (pet ? getSeasonPawsByUser(db.logs, db.acts, pet, seasonSettings, now) : {}),
    [db.logs, db.acts, pet, seasonSettings.enabled, seasonSettings.resetDay, now],
  );
  const seasonActivitiesByUser = useMemo(
    () => (pet ? getSeasonActivitiesByUser(db.logs, pet, seasonSettings, now) : {}),
    [db.logs, pet, seasonSettings.enabled, seasonSettings.resetDay, now],
  );
  const seasonWinner = useMemo(
    () => (pet ? getSeasonWinner(db.logs, db.acts, pet, seasonSettings, now).winnerId : null),
    [db.logs, db.acts, pet, seasonSettings.enabled, seasonSettings.resetDay, now],
  );
  const yearlyChampion = useMemo(
    () => (pet ? getYearlyChampion(pet, new Date(now).getFullYear()) : null),
    [pet, now],
  );
  const monthlyResults = useMemo(() => pet?.monthlyResults ?? [], [pet]);

  const toast = (msg: string, type: ToastType = "info") => uiToast(msg, type);

  /* ================= аккаунты ================= */

  const login = async (email: string, pass: string) => {
    const r = loginUser(ref.current.db, email, pass);
    if ("error" in r) return r.error;
    setUidCur(r.user.id);
    saveSession(r.user.id);
    setActivePetId(null);
    return null;
  };

  const register = async (email: string, pass: string, name: string) => {
    const r = registerUser(ref.current.db, email, pass, name);
    if ("error" in r) return r.error;
    setDb(r.db);
    setUidCur(r.user.id);
    saveSession(r.user.id);
    setActivePetId(null);
    return null;
  };

  const loginDemo = () => {
    const { db: next, user: u } = ensureDemo(ref.current.db);
    setDb(next);
    setUidCur(u.id);
    saveSession(u.id);
    setActivePetId(next.pets.find((p) => p.ownerIds.includes(u.id))?.id ?? null);
  };

  const guest = () => {
    const { db: next, user: u } = makeGuest(ref.current.db);
    setDb(next);
    setUidCur(u.id);
    saveSession(u.id);
  };

  const logout = () => {
    setUidCur(null);
    saveSession(null);
    setActivePetId(null);
  };

  const updateProfile = (patch: Partial<User>) => {
    if (!user) return;
    setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, ...patch } : u)) }));
    if (loadCloudConfig() && (patch.name || patch.color)) {
      cloudTouchAccess(pet?.id ?? "", patch.name ?? user.name, patch.color ?? user.color);
    }
  };

  /* ================= питомцы ================= */

  /** Фаза 3.1: шаг онбординга «Питомец» (тип, кличка, порода, дата рождения, цвет).
   *  Фаза 3.2: вместе с питомцем заводятся стандартные активности с лапками,
   *  лимитами и напоминаниями (makePetWithActs) + план ветеринарии по виду. */
  const createPet = (data: CreatePetData) => {
    if (!user) return;
    const pid = uid();
    const p: Pet = {
      id: pid,
      name: data.name.trim(),
      species: data.species,
      breed: (data.breed ?? "").trim(),
      birthday: data.birthday || undefined,
      color: data.color,
      img: data.img,
      createdAt: Date.now(),
      ownerIds: [user.id],
      ownerRoles: { [user.id]: "owner" },
      invite: genInvite(),
    };
    const { acts: defActs } = makePetWithActs(p);
    const vetEvents = generateVetEventsForPet(p);
    setDb((d) => ({
      ...d,
      pets: [...d.pets, p],
      acts: [...d.acts, ...defActs],
      events: [...d.events, ...vetEvents],
    }));
    setActivePetId(pid);
    trackPetCreated({ petId: pid, species: data.species, hasBirthday: !!data.birthday });
    toast(`${p.name} в доме! Заведены стандартные активности с лапками`, "ok");
    if (loadCloudConfig()) {
      cloudFullPush(
        sanitizeForCloud({ ...ref.current.db, pets: [...ref.current.db.pets, p], acts: [...ref.current.db.acts, ...defActs] }),
        user.id,
      ).catch(() => undefined);
    }
  };

  const setActivePet = (id: string) => setActivePetId(id);

  const regenInvite = () => {
    if (!pet) return;
    const inv = genInvite();
    setDb((d) => ({ ...d, pets: d.pets.map((p) => (p.id === pet.id ? { ...p, invite: inv } : p)) }));
    toast(`Новый код приглашения: ${inv}`, "ok");
  };

  const joinPet = async (code: string) => {
    if (!user) return "Сначала войдите в аккаунт";
    const norm = code.trim().toUpperCase();
    if (!norm) return "Введите код приглашения";
    const target = ref.current.db.pets.find((p) => p.invite.toUpperCase() === norm);
    if (target) {
      if (target.ownerIds.includes(user.id)) return "Вы уже хозяин этого питомца";
      setDb((d) => ({
        ...d,
        pets: d.pets.map((p) => (p.id === target.id
          ? { ...p, ownerIds: [...p.ownerIds, user.id], ownerRoles: { ...(p.ownerRoles ?? {}), [user.id]: "helper" as const } }
          : p)),
      }));
      setActivePetId(target.id);
      toast(`Вы добавлены как второй хозяин: ${target.name}`, "ok");
      return null;
    }
    if (loadCloudConfig()) {
      try {
        const r = await cloudClaimInvite(norm);
        if (!r.ok) return r.error;
        const b = await cloudFetchPetBundle(r.data!);
        if (!b.ok || !b.data) return "Не удалось получить данные питомца";
        const bundle = b.data;
        setDb((d) => ({
          ...d,
          pets: d.pets.some((p) => p.id === bundle.pet.id)
            ? d.pets.map((p) => (p.id === bundle.pet.id
              ? { ...p, ownerIds: Array.from(new Set([...p.ownerIds, user.id])) } : p))
            : [...d.pets, { ...bundle.pet, ownerIds: Array.from(new Set([...bundle.pet.ownerIds, user.id])) }],
          acts: [...d.acts.filter((a) => a.petId !== bundle.pet.id), ...(bundle.acts ?? [])],
          logs: [...d.logs.filter((l) => l.petId !== bundle.pet.id), ...(bundle.logs ?? [])],
          chat: [...(d.chat ?? []), ...(bundle.chat ?? [])],
          events: [...d.events.filter((e) => e.petId !== bundle.pet.id), ...(bundle.events ?? [])],
        }));
        setActivePetId(bundle.pet.id);
        toast(`Присоединились к питомцу: ${bundle.pet.name}`, "ok");
        return null;
      } catch {
        return "Облако недоступно";
      }
    }
    return "Питомец с таким кодом не найден";
  };

  /** Фаза 5.4: удаление хозяина с защитой от «пустого владельца».
   *  Нельзя убрать последнего хозяина и нельзя оставить питомца без «Владельца»
   *  (если убираемый — единственный владелец, право переходит к следующему по списку). */
  const removeOwner = (ownerId: string) => {
    if (!pet) return "Питомец не выбран";
    if (!pet.ownerIds.includes(ownerId)) return "Этот пользователь не является хозяином питомца";
    if (pet.ownerIds.length <= 1) return "Нельзя убрать последнего хозяина — у питомца должен остаться хотя бы один владелец";
    const remaining = pet.ownerIds.filter((x) => x !== ownerId);
    const roleOf = (id: string): Role => pet.ownerRoles?.[id] ?? (pet.ownerIds[0] === id ? "owner" : "helper");
    setDb((d) => ({
      ...d,
      pets: d.pets.map((p) => {
        if (p.id !== pet.id) return p;
        const roles = { ...(p.ownerRoles ?? {}) };
        delete roles[ownerId];
        // защита: если после удаления у питомца не осталось «Владельцев», повышаем первого оставшегося
        if (!remaining.some((id) => roleOf(id) === "owner" && id !== ownerId)) {
          roles[remaining[0]] = "owner";
        }
        return { ...p, ownerIds: remaining, ownerRoles: roles };
      }),
    }));
    toast("Хозяин убран из питомца", "ok");
    return null;
  };

  const getUserRole = (userId: string): Role =>
    pet?.ownerRoles?.[userId] ?? (pet && pet.ownerIds[0] === userId ? "owner" : "helper");

  const setUserRole = (userId: string, role: Role) => {
    if (!pet) return;
    setDb((d) => ({
      ...d,
      pets: d.pets.map((p) => (p.id === pet.id
        ? { ...p, ownerRoles: { ...(p.ownerRoles ?? {}), [userId]: role } } : p)),
    }));
  };

  /** Помощник не может менять набор активностей — только отмечать выполнение */
  const canEditActivities = () => !!user && getUserRole(user.id) === "owner";

  /* ================= активности (CRUD + анти-чит) ================= */

  /** Фаза 3.3: создание своей активности (иконка, цвет, лапки, лимиты день/нед/мес, remindH).
   *  Возвращает id новой активности либо текст ошибки. */
  const addAct: AppCtx["addAct"] = (v) => {
    if (!user || !pet) return "Сначала заведите питомца";
    const title = v.title.trim();
    if (!title) return "Введите название активности";
    if (acts.some((a) => a.title.toLowerCase() === title.toLowerCase())) return "Такая активность уже есть";
    const a: ActivityDef = {
      id: uid(),
      petId: pet.id,
      title,
      icon: v.icon,
      color: v.color,
      paws: Math.max(1, Math.min(50, Math.round(v.paws) || 1)),
      limitDay: v.limitDay, limitWeek: v.limitWeek, limitMonth: v.limitMonth,
      remindH: v.remindH,
      custom: true,
    };
    setDb((d) => ({ ...d, acts: [...d.acts, a] }));
    toast(`Активность «${title}» добавлена`, "ok");
    return a.id;
  };

  /** Фаза 3.3: редактирование активности (стандартной или своей) */
  const updateAct = (id: string, patch: Partial<ActivityDef>) => {
    setDb((d) => ({
      ...d,
      acts: d.acts.map((a) => {
        if (a.id !== id) return a;
        const next: ActivityDef = { ...a, ...patch };
        // нормализуем числовые поля: отрицательных и дробных лимитов не бывает
        next.paws = Math.max(1, Math.min(50, Math.round(Number(next.paws) || 1)));
        for (const k of ["limitDay", "limitWeek", "limitMonth", "remindH"] as const) {
          next[k] = Math.max(0, Math.round(Number(next[k]) || 0));
        }
        return next;
      }),
    }));
  };

  /** Фаза 3.3: удаление активности вместе с её журналом */
  const deleteAct = (id: string) => {
    const a = ref.current.db.acts.find((x) => x.id === id);
    setDb((d) => ({
      ...d,
      acts: d.acts.filter((x) => x.id !== id),
      logs: d.logs.filter((l) => l.actId !== id),
    }));
    if (a) toast(`Активность «${a.title}» удалена`, "ok");
  };

  /**
   * Фаза 3.4: анти-чит. complete() перед записью проверяет дневной/недельный/
   * месячный лимиты через limitsFor() и отказывает при их исчерпании.
   * UI показывает прогресс «2/4 сегодня» рядом с каждой активностью.
   */
  const complete = (actId: string, img?: string, onBehalfOf?: string) => {
    const cur = ref.current;
    const me = cur.user;
    if (!me) return;
    const act = cur.db.acts.find((a) => a.id === actId);
    if (!act) return;
    const petLogs = cur.db.logs.filter((l) => l.petId === act.petId);
    const st = limitsFor(act, petLogs, Date.now());
    if (st.blocked) {
      toast(st.blocked, "err");
      return;
    }
    const log: LogEntry = {
      id: uid(),
      actId: act.id,
      petId: act.petId,
      ownerId: onBehalfOf ?? me.id,
      at: Date.now(),
      img,
      onBehalfOf: onBehalfOf && onBehalfOf !== me.id ? me.id : undefined,
    };
    setDb((d) => ({ ...d, logs: [...d.logs, log] }));
    // Фаза 4.3: начисление лапок + тост «+N лапок»
    toast(`+${act.paws} ${plural(act.paws, "лапка", "лапки", "лапок")}`, "ok");
    trackActivityComplete({ activityId: act.id, activityTitle: act.title, paws: act.paws, hasPhoto: !!img });
    // тяжёлое фото пробуем выгрузить в облако, чтобы localStorage не лопнул
    if (img && img.startsWith("data:") && img.length > 300_000 && loadCloudConfig()) {
      cloudUploadPhoto(act.petId, log.id, img).then((url) => {
        if (!url) return;
        setDb((d) => ({ ...d, logs: d.logs.map((l) => (l.id === log.id ? { ...l, img: url } : l)) }));
      }).catch(() => undefined);
    }
    if (loadCloudConfig()) cloudFullPush(sanitizeForCloud(ref.current.db), me.id).catch(() => undefined);
  };

  /* ================= чат ================= */
  const sendMessage = (text: string) => {
    if (!user || !pet) return;
    const t = text.trim();
    if (!t) return;
    setDb((d) => ({
      ...d,
      chat: [...(d.chat ?? []), { id: uid(), petId: pet.id, authorId: user.id, text: t, at: Date.now() }],
    }));
  };

  /* ================= вет-календарь ================= */
  const addEvent = (input: VetInput) => {
    if (!pet) return "Сначала заведите питомца";
    const title = input.title.trim();
    if (!title) return "Введите название события";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Укажите корректную дату";
    const ev: VetEvent = {
      id: uid(), petId: pet.id, title, kind: input.kind, date: input.date,
      time: input.time, repeat: input.repeat, note: input.note?.trim() || undefined,
    };
    setDb((d) => ({ ...d, events: [...d.events, ev] }));
    return null;
  };

  const updateEvent = (id: string, patch: Partial<VetEvent>) => {
    setDb((d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  };

  const deleteEvent = (id: string) => {
    setDb((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) }));
  };

  /** Пересоздать план прививок по виду/возрасту питомца поверх существующих событий */
  const regenerateVetSchedule = () => {
    if (!pet) return;
    const fresh = generateVetEventsForPet(pet);
    setDb((d) => ({
      ...d,
      events: [...d.events.filter((e) => e.petId !== pet.id), ...fresh],
    }));
    toast(`План ветеринарии обновлён: ${fresh.length} ${fresh.length === 1 ? "событие" : "событий"}`, "ok");
  };

  /* ================= вес и расходы ================= */
  const addWeight: AppCtx["addWeight"] = (w) => {
    if (!pet) return "Сначала заведите питомца";
    if (!(Number(w.weight) > 0)) return "Введите корректный вес";
    if (!w.date) return "Укажите дату";
    setDb((d) => ({
      ...d,
      weights: [...(d.weights ?? []), { id: uid(), petId: pet.id, weight: Number(w.weight), date: w.date, note: w.note }],
    }));
    return null;
  };
  const deleteWeight = (id: string) => {
    setDb((d) => ({ ...d, weights: (d.weights ?? []).filter((w) => w.id !== id) }));
  };

  const addExpense: AppCtx["addExpense"] = (e: any) => {
    if (!pet) return "Сначала заведите питомца";
    if (!(Number(e?.amount) > 0)) return "Введите корректную сумму";
    if (!e?.date) return "Укажите дату";
    setDb((d) => ({
      ...d,
      expenses: [...(d.expenses ?? []), { ...e, amount: Number(e.amount), id: uid(), petId: pet.id, createdAt: Date.now() }],
    }));
    return null;
  };
  const updateExpense = (id: string, patch: Partial<any>) => {
    setDb((d) => ({ ...d, expenses: (d.expenses ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  };
  const deleteExpense = (id: string) => {
    setDb((d) => ({ ...d, expenses: (d.expenses ?? []).filter((x) => x.id !== id) }));
  };

  /* ================= настройки ================= */
  const setTheme = (t: ThemeId) => setTheme_(t);

  const toggleNotif = () => {
    setNotifOn((v) => {
      const next = !v;
      if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => undefined);
      }
      return next;
    });
  };

  const setTg = (patch: Partial<TelegramCfg>) => {
    setTg_((cfg) => {
      const next = { ...cfg, ...patch };
      saveTelegram(next);
      return next;
    });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lapometr-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Файл резервной копии скачан", "ok");
  };

  const resetAll = () => {
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
  };

  const replaceDb = (next: DB) => setDb(next);

  /* ================= сезоны ================= */
  const updateSeasonSettings = (patch: Partial<SeasonSettings>) => {
    if (!pet) return;
    const s = { ...seasonSettings, ...patch };
    setDb((d) => ({ ...d, pets: d.pets.map((p) => (p.id === pet.id ? { ...p, seasonSettings: s } : p)) }));
  };

  /** Закрыть текущий месяц: сохранить победителя в витрину сезона питомца */
  const finalizeCurrentMonth = () => {
    if (!pet) return;
    const month = isoMonth(now);
    if ((pet.monthlyResults ?? []).some((r) => r.month === month)) {
      toast("Этот месяц уже закрыт", "info");
      return;
    }
    const result: MonthlyResult = {
      petId: pet.id,
      month,
      winnerId: seasonWinner,
      pawsByUser: seasonPawsByUser,
      activitiesByUser: seasonActivitiesByUser,
      finalizedAt: Date.now(),
    };
    setDb((d) => ({
      ...d,
      pets: d.pets.map((p) => (p.id === pet.id
        ? { ...p, monthlyResults: [...(p.monthlyResults ?? []), result] } : p)),
    }));
    const w = seasonWinner ? owners.find((o) => o.id === seasonWinner) : null;
    toast(w ? `Месяц закрыт. Победитель: ${w.name}` : "Месяц закрыт. Победителя нет (ничья?)", "ok");
  };

  /* ================= облако ================= */
  const syncFromCloud = async () => {
    const r = await cloudPull();
    if (!r.ok) { toast(r.error, "err"); return false; }
    if (!r.data) { toast("Облако пусто", "err"); return false; }
    setDb(r.data.data);
    toast("Данные загружены из облака", "ok");
    return true;
  };

  const pushToCloud = async () => {
    const me = ref.current.user;
    if (!me) return false;
    const r = await cloudFullPush(sanitizeForCloud(ref.current.db), me.id);
    if (!r.ok) { toast(r.error, "err"); return false; }
    toast("Данные отправлены в облако", "ok");
    return true;
  };

  const fetchDivergence = async (): Promise<Divergence | null> => {
    const me = ref.current.user;
    if (!me) return null;
    const remote = await cloudRowFetch(me.cloudId ?? "");
    if (!remote.ok || !remote.data) return null;
    return computeDivergence(ref.current.db, remote.data, me.id);
  };

  const applyMerge = async () => {
    const cur = ref.current;
    const me = cur.user;
    if (!me) return;
    const remote = await cloudRowFetch(me.cloudId ?? "");
    if (!remote.ok || !remote.data) { toast(remote.ok ? "Нет данных" : remote.error, "err"); return; }
    const merged = mergeRemoteRows(cur.db, remote.data, me.id, me.cloudId ?? "");
    setDb(merged.db);
    setOutboxN(outboxCount());
    toast(`Слияние завершено: расхождений осталось ${divergenceTotal(merged.stats)}`, "ok");
  };

  const flushOutboxNow = async () => {
    const n = await flushOutbox(ref.current.db, ref.current.user?.id ?? "");
    setOutboxN(outboxCount());
    return n;
  };

  /* ---- статус облачного аккаунта + realtime-подписка ---- */
  useEffect(() => {
    if (!loadCloudConfig()) return;
    let alive = true;
    cloudCurrentUser().then((u) => {
      if (!alive || !u) return;
      setCloudUser(u);
      const me = ref.current.user;
      if (me && !me.cloudId) {
        setDb((d) => ({ ...d, users: d.users.map((x) => (x.id === me.id ? { ...x, cloudId: u.id } : x)) }));
      }
    }).catch(() => undefined);
    const un = subscribeRealtime(
      (p) => {
        setDb((d) => {
          const row = (p.eventType === "DELETE" ? p.old : p.new) as any;
          if (!row) return d;
          const id = String(row.id ?? "");
          if (p.table === "logs") {
            if (p.eventType === "DELETE") return { ...d, logs: d.logs.filter((x) => x.id !== id) };
            const inc: LogEntry = {
              id, petId: String(row.pet_id), actId: String(row.act_id),
              ownerId: String(row.owner_id), at: Number(row.at), img: row.img ?? undefined,
            };
            return { ...d, logs: d.logs.some((x) => x.id === id) ? d.logs.map((x) => (x.id === id ? { ...x, ...inc } : x)) : [...d.logs, inc] };
          }
          if (p.table === "chat_messages") {
            if (p.eventType === "DELETE") return { ...d, chat: (d.chat ?? []).filter((x) => x.id !== id) };
            const inc = { id, petId: String(row.pet_id), authorId: String(row.author_id), text: String(row.text), at: Number(row.at) };
            return { ...d, chat: (d.chat ?? []).some((x) => x.id === id) ? (d.chat ?? []).map((x) => (x.id === id ? inc : x)) : [...(d.chat ?? []), inc] };
          }
          if (p.table === "vet_events") {
            if (p.eventType === "DELETE") return { ...d, events: d.events.filter((x) => x.id !== id) };
            const inc: VetEvent = {
              id, petId: String(row.pet_id), kind: row.kind, title: String(row.title),
              date: String(row.date), time: row.time ?? undefined, repeat: row.repeat ?? "none", note: row.note ?? undefined,
            };
            return { ...d, events: d.events.some((x) => x.id === id) ? d.events.map((x) => (x.id === id ? inc : x)) : [...d.events, inc] };
          }
          return d;
        });
      },
      (s) => setRtStatus(s),
    );
    return () => { alive = false; un(); };
  }, []);

  /* ---- напоминания: браузерные уведомления + Telegram ---- */
  useEffect(() => {
    const check = () => {
      const cur = ref.current;
      if (!cur.user) return;
      const myPets = cur.db.pets.filter((p) => p.ownerIds.includes(cur.user!.id));
      if (!myPets.length) return;
      const due = computeDue(cur.db.acts, cur.db.logs, Date.now())
        .filter((d) => myPets.some((p) => p.id === d.act.petId) && d.overdueMin !== null && d.overdueMin > 0);
      if (!due.length) return;
      const top = due[0];
      const msg = `Пора: «${top.act.title}» — просрочено на ${Math.round(top.overdueMin!)} мин`;
      if (notifOn && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification("Лапометр", { body: msg }); } catch { /* noop */ }
      }
      if (tg.enabled && tg.remindDue && tg.botToken && tg.chatId) {
        const key = `due:${top.act.id}:${startOfDay(Date.now())}:${Math.floor(Date.now() / HOUR)}`;
        import("../lib/telegram").then(({ markSent, wasSent }) => {
          if (wasSent(key)) return;
          markSent(key);
          tgSend(tg, `🐾 <b>${msg}</b>`).catch(() => undefined);
        });
      }
    };
    const t = setInterval(check, 5 * 60_000);
    check();
    return () => clearInterval(t);
  }, [notifOn, tg.enabled, tg.remindDue]);

  const value: AppCtx = {
    db, user, pet, users: db.users, pets: db.pets, userPets, owners,
    acts, logs, events, chat, weights, expenses, monthlyResults,
    now, theme, notifOn, tg, cloudUser, rtStatus, outboxN,
    seasonInfo, seasonPawsByUser, seasonActivitiesByUser, seasonLogs, seasonWinner, yearlyChampion,
    login, register, loginDemo, guest, logout, updateProfile,
    createPet, setActivePet, regenInvite, joinPet, removeOwner, getUserRole, setUserRole, canEditActivities,
    addAct, updateAct, deleteAct, complete,
    sendMessage,
    addEvent, updateEvent, deleteEvent, regenerateVetSchedule,
    addWeight, deleteWeight, addExpense, updateExpense, deleteExpense,
    setTheme, toggleNotif, setTg, exportData, resetAll, replaceDb, toast,
    updateSeasonSettings, finalizeCurrentMonth,
    syncFromCloud, pushToCloud, fetchDivergence, applyMerge, flushOutboxNow,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
