import {
  createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type {
  ActivityDef, ChatMessage, DB, IconName, LogEntry, Pet, Species, TelegramCfg,
  ThemeId, User, VetEvent, VetKind,
} from "../lib/types";
import { LEVELS, genInvite, levelFor, uid } from "../lib/types";
import {
  computeDue, dueLabel, durText, ensureDemo, limitsFor, loadActivePet, loadDB,
  loadNotif, loadSession, loadTelegram, loadTheme,
  loginUser, makeGuest, makePetWithActs, nextOccurrence, pawsOf, registerUser,
  saveActivePet, saveDB, saveNotif, saveSession, saveTelegram, saveTheme, startOfDay,
} from "../lib/db";
import { markSent, tgSend, wasSent } from "../lib/telegram";
import {
  cloudClaimInvite, cloudCurrentUser, cloudDeletePhotoUrls, cloudFetchDisplays,
  cloudFetchPetBundle, cloudFullPush, cloudRowFetch, cloudSendDiff, cloudTouchAccess,
  cloudUploadPhoto, cloudUpsertLogRow, computeDivergence, divergenceTotal,
  enqueueOutbox, flushOutbox, isStorageUrl, loadCloudConfig,
  mergeRemoteRows, onCloudAuthChange, outboxCount,
  subscribeRealtime,
  type CloudUser, type Divergence, type PetBundle, type RemoteRows, type RtPayload, type RtStatus,
} from "../lib/cloud";

export interface Toast { id: string; text: string; kind: "ok" | "warn" | "err" | "paw" }

export interface NewActInput {
  title: string; icon: IconName; color: string; paws: number;
  limitDay: number; limitWeek: number; limitMonth: number; remindH: number;
}

export interface VetInput {
  title: string; kind: VetKind; date: string; time?: string;
  repeat: VetEvent["repeat"]; note?: string;
}

interface Ctx {
  db: DB;
  user: User | null;
  pet: Pet | null;
  userPets: Pet[];
  setActivePet: (id: string) => void;
  acts: ActivityDef[];
  logs: LogEntry[];
  chat: ChatMessage[];
  events: VetEvent[];
  tg: TelegramCfg;
  owners: User[];
  theme: ThemeId;
  toasts: Toast[];
  now: number;
  notifOn: boolean;
  register: (email: string, pass: string, name: string) => string | null;
  login: (email: string, pass: string) => string | null;
  loginDemo: () => void;
  guest: () => void;
  logout: () => void;
  updateProfile: (patch: Partial<Pick<User, "name" | "color" | "img">>) => void;
  createPet: (data: { name: string; species: Species; breed: string; birthday: string; color: string; img?: string }) => void;
  complete: (actId: string, img?: string) => void;
  sendMessage: (text: string) => void;
  addEvent: (input: VetInput) => string | null;
  updateEvent: (id: string, patch: Partial<VetEvent>) => void;
  deleteEvent: (id: string) => void;
  setTg: (patch: Partial<TelegramCfg>) => void;
  addAct: (input: NewActInput) => string | null;
  updateAct: (id: string, patch: Partial<ActivityDef>) => void;
  deleteAct: (id: string) => void;
  regenInvite: () => void;
  joinPet: (code: string) => Promise<string | null>;
  removeOwner: (ownerId: string) => void;
  cloudUser: CloudUser | null;
  rtStatus: RtStatus;
  setTheme: (t: ThemeId) => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
  toggleNotif: () => void;
  exportData: () => void;
  resetAll: () => void;
  replaceDb: (next: DB) => void;
  /** Построчная синхронизация из облака: долить недостающие строки */
  syncFromCloud: () => Promise<string | null>;
  /** Детекция расхождений с облаком без слияния (для merge-диалога) */
  fetchDivergence: () => Promise<Divergence | string>;
  /** Применить отложенное слияние с облаком (после подтверждения в диалоге) */
  applyMerge: () => Promise<void>;
  /** Отправить накопленную outbox-очередь неотправленных операций */
  flushOutboxNow: () => Promise<number>;
  /** Число операций в outbox-очереди, ожидающих отправки */
  outboxN: number;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => loadDB());
  const [userId, setUserId] = useState<string | null>(() => loadSession());
  const [activePetId, setActivePetId] = useState<string | null>(() => loadActivePet());
  const [theme, setThemeState] = useState<ThemeId>(() => loadTheme());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [notifOn, setNotifOn] = useState(() => loadNotif());
  const [tg, setTgState] = useState<TelegramCfg>(() => loadTelegram());
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [rtStatus, setRtStatus] = useState<RtStatus>("off");
  const [outboxN, setOutboxN] = useState<number>(() => outboxCount());
  const lastSaved = useRef<string>("");
  const notified = useRef<Set<string>>(new Set());
  const lastRtToast = useRef(0);
  /* облачные строки, отложенные для merge-диалога (применяются в applyMerge) */
  const pendingRemoteRef = useRef<RemoteRows | null>(null);

  /* актуальные значения для колбэков подписки */
  const dbRef = useRef(db);
  const cloudUserRef = useRef<CloudUser | null>(null);
  const userRef = useRef<User | null>(null);
  const autoLoginTried = useRef(false);
  const setDbBoth = useCallback((d: DB) => { dbRef.current = d; setDb(d); }, []);

  /* ---------- облачная сессия ---------- */
  useEffect(() => {
    if (loadCloudConfig()) void cloudCurrentUser().then(setCloudUser);
    const un = onCloudAuthChange((u) => setCloudUser(u));
    return un;
  }, []);

  /* ---------- тема ---------- */
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const setTheme = (t: ThemeId) => { setThemeState(t); saveTheme(t); };

  /* ---------- тик времени ---------- */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  /* ---------- синхронизация вкладок ---------- */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === "lapometr.db.v1") setDbBoth(loadDB()); };
    const onCustom = () => {
      const fresh = loadDB();
      if (JSON.stringify(fresh) !== lastSaved.current) setDbBoth(fresh);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("lapometr:db", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("lapometr:db", onCustom);
    };
  }, []);

  /* ---------- производные ---------- */
  const user = useMemo(() => db.users.find((u) => u.id === userId) ?? null, [db, userId]);
  const userPets = useMemo(
    () => (user ? db.pets.filter((p) => p.ownerIds.includes(user.id)) : []),
    [db, user],
  );
  const pet = useMemo(
    () => userPets.find((p) => p.id === activePetId) ?? userPets[0] ?? null,
    [userPets, activePetId],
  );
  const setActivePet = (id: string) => { setActivePetId(id); saveActivePet(id); };
  const chat = useMemo(
    () => (pet ? db.chat.filter((m) => m.petId === pet.id).sort((a, b) => a.at - b.at) : []),
    [db, pet],
  );
  const events = useMemo(
    () => (pet ? db.events.filter((e) => e.petId === pet.id) : []),
    [db, pet],
  );
  const acts = useMemo(() => (pet ? db.acts.filter((a) => a.petId === pet.id) : []), [db, pet]);
  const logs = useMemo(() => (pet ? db.logs.filter((l) => l.petId === pet.id) : []), [db, pet]);
  const owners = useMemo(
    () => (pet ? pet.ownerIds.map((id) => db.users.find((u) => u.id === id)).filter(Boolean) as User[] : []),
    [db, pet],
  );

  /* ---------- тосты ---------- */
  const toast = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = uid();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);
  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  /* ---------- облачная досылка «живых» строк ---------- */
  const sendDiff = useCallback((prev: DB, next: DB) => {
    const cu = cloudUserRef.current;
    if (!cu || !loadCloudConfig()) return;
    const me = next.users.find((u) => u.cloudId === cu.id);
    if (!me) return;
    const myPets = new Set(next.pets.filter((p) => p.ownerIds.includes(me.id)).map((p) => p.id));
    if (!myPets.size) return;
    const pLogs = new Set(prev.logs.map((l) => l.id));
    const pChat = new Set(prev.chat.map((m) => m.id));
    const pEv = new Map(prev.events.map((e) => [e.id, JSON.stringify(e)] as const));
    const diff = {
      logs: next.logs.filter((l) => !pLogs.has(l.id) && myPets.has(l.petId)),
      chat: next.chat.filter((m) => !pChat.has(m.id) && myPets.has(m.petId)),
      events: next.events.filter((e) => myPets.has(e.petId) && pEv.get(e.id) !== JSON.stringify(e)),
      delEvents: prev.events
        .filter((e) => myPets.has(e.petId) && !next.events.some((n) => n.id === e.id))
        .map((e) => e.id),
    };
    if (!diff.logs.length && !diff.chat.length && !diff.events.length && !diff.delEvents.length) return;
    if (!navigator.onLine) {
      /* офлайн: складываем в очередь, отправим при появлении сети */
      enqueueOutbox(diff);
      setOutboxN(outboxCount());
      return;
    }
    void cloudSendDiff(next, me.id, diff).then((ok) => {
      if (!ok) {
        /* не ушло (сеть мигнула, сервер недоступен) — в очередь */
        enqueueOutbox(diff);
        setOutboxN(outboxCount());
      }
    });
  }, []);

  const commit = useCallback((d: DB, opts?: { fromCloud?: boolean }) => {
    const prev = dbRef.current;
    lastSaved.current = JSON.stringify(d);
    saveDB(d);
    setDbBoth(d);
    if (!opts?.fromCloud && prev !== d) sendDiff(prev, d);
  }, [sendDiff, setDbBoth]);

  /* привязка локального аккаунта к облачному (cloudId) */
  useEffect(() => {
    cloudUserRef.current = cloudUser;
    if (!cloudUser || !user || user.cloudId === cloudUser.id) return;
    const d = structuredClone(dbRef.current);
    const u = d.users.find((x) => x.id === user.id);
    if (u) { u.cloudId = cloudUser.id; commit(d, { fromCloud: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUser, user?.id]);

  /* Авто-вход по облачной сессии (один раз за загрузку).
     Снапшот не хранит пароли (гигиена), поэтому после восстановления или на
     новом устройстве вход продолжается через облачный аккаунт: если локальной
     сессии нет, но есть активная облачная, связанная с локальным профилем по
     cloudId, — логинимся под ним. Явный logout в течение сессии не затирается,
     т.к. попытка делается единожды. */
  useEffect(() => {
    if (autoLoginTried.current || !cloudUser) return;
    autoLoginTried.current = true;
    if (userId) return;
    const linked = dbRef.current.users.find((u) => u.cloudId === cloudUser.id);
    if (!linked) return;
    setUserId(linked.id);
    saveSession(linked.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUser, userId]);

  /* ---------- outbox: авто-отправка очереди при появлении сети / Realtime ---------- */
  const doFlushOutbox = useCallback(() => {
    const cu = cloudUserRef.current;
    const me = cu ? dbRef.current.users.find((u) => u.cloudId === cu.id) : null;
    if (!cu || !me || !loadCloudConfig() || !navigator.onLine) return;
    if (!outboxCount()) return;
    void flushOutbox(dbRef.current, me.id).finally(() => setOutboxN(outboxCount()));
  }, []);

  useEffect(() => {
    const onOnline = () => doFlushOutbox();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [doFlushOutbox]);

  /* при восстановлении Realtime-канала тоже пробуем разобрать очередь */
  useEffect(() => {
    if (rtStatus === "live") doFlushOutbox();
  }, [rtStatus, doFlushOutbox]);

  /* ---------- Realtime: живые записи с других устройств ---------- */
  useEffect(() => { userRef.current = user; }, [user]);
  const petIdsKey = userPets.map((p) => p.id).join(",");
  useEffect(() => {
    if (!cloudUser || !userRef.current?.cloudId || !petIdsKey) { setRtStatus("off"); return; }
    const meId = userRef.current.id;

    /* хозяин по cloud id: известный локальный или «тень» с именем из облака */
    const resolveOwner = async (d: DB, cloudId: string): Promise<string> => {
      const known = d.users.find((u) => u.cloudId === cloudId);
      if (known) return known.id;
      const disp = await cloudFetchDisplays([cloudId]);
      const info = disp[cloudId];
      d.users.push({
        id: cloudId, email: "", name: info?.name ?? "Хозяин", pass: "",
        color: info?.color ?? "#8fb7c9", createdAt: Date.now(), cloudId,
      });
      return cloudId;
    };

    const onPayload = async (p: RtPayload) => {
      const cur = dbRef.current;
      const myPets = new Set(cur.pets.filter((pp) => pp.ownerIds.includes(meId)).map((pp) => pp.id));
      const row = (p.eventType === "DELETE" ? p.old : p.new) as
        | { id?: string; pet_id?: string; act_id?: string; owner_id?: string; author_id?: string; at?: string; img?: string | null; text?: string; kind?: string; title?: string; date?: string; time?: string | null; repeat?: string; note?: string | null }
        | null;
      if (!row?.id || !row.pet_id || !myPets.has(row.pet_id)) return;

      if (p.table === "logs") {
        if (p.eventType === "DELETE") {
          if (!cur.logs.some((l) => l.id === row.id)) return;
          const d = structuredClone(cur);
          d.logs = d.logs.filter((l) => l.id !== row.id);
          commit(d, { fromCloud: true });
          return;
        }
        if (p.eventType !== "INSERT" || cur.logs.some((l) => l.id === row.id)) return;
        const d = structuredClone(cur);
        const ownerId = await resolveOwner(d, String(row.owner_id));
        d.logs.push({
          id: row.id!, petId: row.pet_id, actId: String(row.act_id), ownerId,
          at: Date.parse(String(row.at)), img: row.img ?? undefined,
        });
        const petObj = d.pets.find((x) => x.id === row.pet_id);
        if (petObj && !petObj.ownerIds.includes(ownerId)) petObj.ownerIds.push(ownerId);
        commit(d, { fromCloud: true });
        const t = Date.now();
        if (t - lastRtToast.current > 2500) {
          lastRtToast.current = t;
          const who = d.users.find((u) => u.id === ownerId);
          const act = cur.acts.find((a) => a.id === row.act_id);
          toast(`${who?.name ?? "Хозяин"} · ${act?.title ?? "забота"} — прилетело в журнал`, "ok");
        }
        return;
      }

      if (p.table === "chat_messages") {
        if (p.eventType !== "INSERT" || cur.chat.some((m) => m.id === row.id)) return;
        const d = structuredClone(cur);
        const authorId = await resolveOwner(d, String(row.author_id));
        d.chat.push({
          id: row.id!, petId: row.pet_id, authorId,
          text: String(row.text ?? ""), at: Date.parse(String(row.at)),
        });
        commit(d, { fromCloud: true });
        return;
      }

      if (p.table === "vet_events") {
        if (p.eventType === "INSERT" && cur.events.some((e) => e.id === row.id)) return;
        const d = structuredClone(cur);
        d.events = d.events.filter((e) => e.id !== row.id);
        if (p.eventType !== "DELETE") {
          d.events.push({
            id: row.id!, petId: row.pet_id,
            kind: (row.kind ?? "other") as VetEvent["kind"],
            title: String(row.title ?? "Событие"), date: String(row.date ?? ""),
            time: row.time ?? undefined,
            repeat: (row.repeat ?? "none") as VetEvent["repeat"],
            note: row.note ?? undefined,
          });
        }
        commit(d, { fromCloud: true });
      }
    };

    const un = subscribeRealtime((p) => { void onPayload(p); }, setRtStatus);
    return un;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUser, user?.cloudId, petIdsKey, commit, toast]);

  /* ---------- напоминания: браузер + Telegram ---------- */
  const tgReady = tg.enabled && tg.botToken.trim().length > 10 && tg.chatId.trim().length > 0;
  useEffect(() => {
    const canNotify = notifOn && "Notification" in window && Notification.permission === "granted";
    if (!pet || (!canNotify && !tgReady)) return;
    const check = () => {
      const t = Date.now();
      const items: { key: string; text: string }[] = [];

      /* активности с напоминанием */
      if (tg.remindDue || canNotify) {
        for (const it of computeDue(acts, logs, t)) {
          if (it.overdueMin !== null && it.overdueMin > 0 && it.dueAt) {
            items.push({
              key: `${it.act.id}@${it.dueAt}`,
              text: `«${it.act.title}» — просрочено на ${durText(it.overdueMin)}`,
            });
          }
        }
      }
      /* вет-события: сегодня, просроченные и (для разовых) прошедшие */
      if (tg.remindVet || canNotify) {
        for (const ev of events) {
          const occ = nextOccurrence(ev, t);
          const dueToday = startOfDay(occ) <= t;
          if (dueToday) {
            items.push({ key: `vet@${ev.id}@${occ}`, text: `«${ev.title}» — ${dueLabel(ev, t).text}` });
          }
        }
      }

      /* браузерные уведомления */
      if (canNotify) {
        for (const it of items) {
          if (!notified.current.has(it.key)) {
            notified.current.add(it.key);
            try { new Notification("Лапометр", { body: `${pet.name}: ${it.text}` }); } catch { /* noop */ }
          }
        }
      }
      /* telegram: одно сводное сообщение, каждый пункт — один раз */
      if (tgReady) {
        const fresh = items.filter((i) => !wasSent(i.key));
        if (fresh.length > 0) {
          const html = `🐾 <b>Лапометр: пора позаботиться</b>\n\n${
            fresh.map((f) => `• ${pet.name}: ${f.text}`).join("\n")
          }\n\nОтметьте выполнение в журнале!`;
          tgSend(tg, html)
            .then(() => fresh.forEach((f) => markSent(f.key)))
            .catch(() => { /* сеть/лимиты — попробуем в следующий тик */ });
        }
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [notifOn, tgReady, tg, pet, acts, logs, events]);

  /* ---------- действия ---------- */
  const register = (email: string, pass: string, name: string): string | null => {
    const r = registerUser(db, email, pass, name);
    if ("error" in r) return r.error;
    commit(r.db);
    setUserId(r.user.id);
    saveSession(r.user.id);
    return null;
  };

  const login = (email: string, pass: string): string | null => {
    const r = loginUser(db, email, pass);
    if ("error" in r) return r.error;
    setUserId(r.user.id);
    saveSession(r.user.id);
    return null;
  };

  const loginDemo = () => {
    const r = ensureDemo(db);
    commit(r.db);
    setUserId(r.user.id);
    saveSession(r.user.id);
  };

  const guest = () => {
    const r = makeGuest(db);
    commit(r.db);
    setUserId(r.user.id);
    saveSession(r.user.id);
  };

  const logout = () => { saveSession(null); setUserId(null); };

  const updateProfile = (patch: Partial<Pick<User, "name" | "color" | "img">>) => {
    if (!user) return;
    const d = structuredClone(db);
    const u = d.users.find((x) => x.id === user.id);
    if (!u) return;
    Object.assign(u, patch);
    commit(d);
    toast("Профиль обновлён");
  };

  const createPet: Ctx["createPet"] = (data) => {
    if (!user) return;
    const p: Pet = {
      id: uid(), name: data.name, species: data.species, breed: data.breed,
      birthday: data.birthday, color: data.color, img: data.img,
      ownerIds: [user.id], invite: genInvite(), createdAt: Date.now(),
    };
    const d = structuredClone(db);
    d.pets.push(p);
    d.acts.push(...makePetWithActs(p).acts);
    commit(d);
    setActivePet(p.id);
    if (userPets.length > 0) toast(`${p.name} теперь в вашей стае`);
  };

  /** base64-фото → Supabase Storage → ссылка в logs.img (локально и в облаке) */
  const persistPhoto = (logId: string, petId: string, dataUrl: string) => {
    if (!loadCloudConfig() || !cloudUserRef.current) return;
    void cloudUploadPhoto(petId, logId, dataUrl).then(async (url) => {
      if (!url) {
        toast("Фото не загрузилось в облако — осталось на устройстве", "warn");
        return;
      }
      const d = structuredClone(dbRef.current);
      const l = d.logs.find((x) => x.id === logId);
      if (!l) return;
      l.img = url;
      commit(d, { fromCloud: true });
      await cloudUpsertLogRow(d, l);
    });
  };

  const complete = (actId: string, img?: string) => {
    if (!user || !pet) return;
    const act = acts.find((a) => a.id === actId);
    if (!act) return;
    const t = Date.now();
    const st = limitsFor(act, logs, t);
    if (st.blocked) { toast(st.blocked, "err"); return; }
    const before = pawsOf(acts, logs);
    const d = structuredClone(db);
    const logId = uid();
    d.logs.push({ id: logId, petId: pet.id, actId, ownerId: user.id, at: t, ...(img ? { img } : {}) });
    commit(d);
    toast(`+${act.paws} лапок: «${act.title}»`, "paw");
    if (levelFor(before + act.paws).idx > levelFor(before).idx) {
      setTimeout(() => toast(`Новый уровень заботы: «${levelFor(before + act.paws).title}»`, "ok"), 700);
    }
    /* фото улетает в Storage фоном: журнал не ждёт сеть */
    if (img && img.startsWith("data:") && user.cloudId) {
      setTimeout(() => persistPhoto(logId, pet.id, img), 600);
    }
  };

  const addAct = (input: NewActInput): string | null => {
    if (!pet) return "Сначала создайте питомца";
    if (!input.title.trim()) return "Введите название активности";
    const d = structuredClone(db);
    d.acts.push({
      id: uid(), petId: pet.id, title: input.title.trim(), icon: input.icon, color: input.color,
      paws: Math.max(1, Math.min(50, Math.round(input.paws))),
      limitDay: Math.max(0, input.limitDay), limitWeek: Math.max(0, input.limitWeek),
      limitMonth: Math.max(0, input.limitMonth), remindH: Math.max(0, input.remindH),
      custom: true,
    });
    commit(d);
    toast("Активность добавлена");
    return null;
  };

  const updateAct = (id: string, patch: Partial<ActivityDef>) => {
    const d = structuredClone(db);
    const a = d.acts.find((x) => x.id === id);
    if (!a) return;
    Object.assign(a, patch);
    commit(d);
    toast("Активность обновлена");
  };

  const deleteAct = (id: string) => {
    const gonePhotos = db.logs
      .filter((l) => l.actId === id && isStorageUrl(l.img))
      .map((l) => l.img as string);
    const d = structuredClone(db);
    d.acts = d.acts.filter((x) => x.id !== id);
    d.logs = d.logs.filter((l) => l.actId !== id);
    commit(d);
    toast("Активность удалена вместе со своими записями", "warn");
    if (gonePhotos.length && loadCloudConfig()) {
      void cloudDeletePhotoUrls(gonePhotos).then((n) => {
        if (n > 0) toast(`Фото удалённых записей стёрты из облака (${n})`, "warn");
      });
    }
  };

  const regenInvite = () => {
    if (!pet) return;
    const d = structuredClone(db);
    const p = d.pets.find((x) => x.id === pet.id);
    if (!p) return;
    p.invite = genInvite();
    commit(d);
    toast("Новый код приглашения создан");
  };

  const joinPet = async (code: string): Promise<string | null> => {
    if (!user) return "Нужна учётная запись";
    const c = code.trim().toUpperCase();

    /* 1) облачный вход по коду: питомец скачивается вместе с историей */
    if (loadCloudConfig() && cloudUserRef.current && user.cloudId) {
      const claim = await cloudClaimInvite(c);
      if (claim.ok && claim.data) {
        const bundle = await cloudFetchPetBundle(claim.data);
        if (bundle.ok && bundle.data) {
          const err = await mergeBundle(bundle.data);
          if (!err) {
            void cloudTouchAccess(bundle.data.pet.id, user.name, user.color);
            return null;
          }
          return err;
        }
        return bundle.ok ? "Не удалось скачать питомца из облака" : bundle.error;
      }
      /* «invalid invite code» — пробуем локально; прочие ошибки (миграция не
         накатана и т.п.) тоже не блокируют локальный сценарий */
    }

    /* 2) локальный код (один браузер) */
    const p = db.pets.find((x) => x.invite.toUpperCase() === c);
    if (!p) return "Код не найден — проверьте приглашение";
    if (p.ownerIds.includes(user.id)) return "Вы уже хозяин этого питомца";
    const d = structuredClone(db);
    d.pets.find((x) => x.id === p.id)!.ownerIds.push(user.id);
    commit(d);
    setActivePet(p.id);
    toast(`Теперь вы вместе ухаживаете за ${p.name}`);
    return null;
  };

  /** Слияние скачанного из облака питомца с локальной БД (без дублей) */
  const mergeBundle = async (b: PetBundle): Promise<string | null> => {
    const me = userRef.current;
    if (!me) return "Нужна учётная запись";
    const d = structuredClone(dbRef.current);

    /* «тени» облачных хозяев: участники из pet_owners/cloud_access
       (+ страховочный вывод из журнала и чата для старых проектов) */
    const foreignIds = [...new Set([
      ...(b.memberIds ?? []),
      ...b.logs.map((l) => l.ownerId),
      ...b.chat.map((m) => m.authorId),
    ])].filter((id) => id !== me.cloudId && !d.users.some((u) => u.id === id || u.cloudId === id));
    const disp = foreignIds.length ? await cloudFetchDisplays(foreignIds) : {};
    const ownerMap = new Map<string, string>();
    for (const cid of foreignIds) {
      const shadow: User = {
        id: cid, email: "", name: disp[cid]?.name ?? "Хозяин", pass: "",
        color: disp[cid]?.color ?? "#8fb7c9", createdAt: Date.now(), cloudId: cid,
      };
      d.users.push(shadow);
      ownerMap.set(cid, cid);
    }
    const localOf = (cid: string) =>
      d.users.find((u) => u.cloudId === cid)?.id ?? ownerMap.get(cid) ?? cid;

    let pet = d.pets.find((x) => x.id === b.pet.id);
    if (pet) {
      if (!pet.ownerIds.includes(me.id)) pet.ownerIds.push(me.id);
    } else {
      pet = { ...b.pet, ownerIds: [me.id] };
      d.pets.push(pet);
      d.acts.push(...b.acts.filter((a) => !d.acts.some((x) => x.id === a.id)));
    }
    const petId = pet.id;
    const foreignOwners = new Set<string>();
    for (const l of b.logs) {
      if (d.logs.some((x) => x.id === l.id)) continue;
      const ownerId = localOf(l.ownerId);
      d.logs.push({ ...l, ownerId });
      foreignOwners.add(ownerId);
    }
    for (const m of b.chat) {
      if (d.chat.some((x) => x.id === m.id)) continue;
      d.chat.push({ ...m, authorId: localOf(m.authorId) });
    }
    for (const e of b.events) {
      if (d.events.some((x) => x.id === e.id)) continue;
      d.events.push(e);
    }
    const pp = d.pets.find((x) => x.id === petId)!;
    foreignOwners.forEach((oid) => { if (!pp.ownerIds.includes(oid)) pp.ownerIds.push(oid); });
    /* все участники (из pet_owners/cloud_access) тоже становятся хозяевами */
    for (const cid of b.memberIds ?? []) {
      const oid = cid === me.cloudId ? me.id : localOf(cid);
      if (!pp.ownerIds.includes(oid)) pp.ownerIds.push(oid);
    }

    commit(d, { fromCloud: true });
    setActivePet(petId);
    toast(`${pet.name} теперь с вами — журнал синхронизируется в реальном времени`);
    return null;
  };

  /**
   * Построчная синхронизация из облака: скачиваем все строки по своим питомцам
   * и аккуратно доливаем недостающее (снапшот при этом остаётся резервной копией).
   */
  const syncFromCloud = async (): Promise<string | null> => {
    if (!user) return "Нужна учётная запись";
    if (!user.cloudId) return "Локальный профиль не связан с облачным аккаунтом";
    const res = await cloudRowFetch(user.cloudId);
    if (!res.ok) return res.error;
    const remote = res.data;
    if (!remote) return "Не удалось прочитать данные из облака";
    const { db: merged, stats } = mergeRemoteRows(dbRef.current, remote, user.id, user.cloudId);
    const added = stats.pets + stats.acts + stats.logs + stats.chat + stats.events + stats.owners;
    commit(merged, { fromCloud: true });
    if (added === 0) {
      toast("Всё актуально — новых строк в облаке нет");
    } else {
      const parts: string[] = [];
      if (stats.logs) parts.push(`${stats.logs} записей`);
      if (stats.chat) parts.push(`${stats.chat} сообщений`);
      if (stats.events) parts.push(`${stats.events} событий`);
      if (stats.acts) parts.push(`${stats.acts} активностей`);
      if (stats.pets) parts.push(`${stats.pets} питомцев`);
      if (stats.owners) parts.push(`${stats.owners} хозяев`);
      toast(`Из облака добавлено: ${parts.join(", ")}`);
    }
    return null;
  };

  /**
   * Детекция расхождений с облаком без слияния. Скачивает облачные строки,
   * откладывает их для applyMerge и возвращает двустороннюю разницу —
   * её показывает merge-диалог («в облаке на N записей больше — объединить?»).
   */
  const fetchDivergence = async (): Promise<Divergence | string> => {
    if (!user) return "Нужна учётная запись";
    if (!user.cloudId) return "Локальный профиль не связан с облачным аккаунтом";
    const res = await cloudRowFetch(user.cloudId);
    if (!res.ok) return res.error;
    const remote = res.data;
    if (!remote) return "Не удалось прочитать данные из облака";
    pendingRemoteRef.current = remote;
    return computeDivergence(dbRef.current, remote, user.id);
  };

  /**
   * Применить отложенное слияние: заново мерджит свежие локальные данные с
   * облачными строками (безопасно, если между диалогом и подтверждением были
   * новые записи), коммитит и досылает всё обратно для двусторонней целостности.
   */
  const applyMerge = async (): Promise<void> => {
    const remote = pendingRemoteRef.current;
    if (!remote || !user?.cloudId) return;
    const { db: merged, stats } = mergeRemoteRows(dbRef.current, remote, user.id, user.cloudId);
    commit(merged, { fromCloud: true });
    pendingRemoteRef.current = null;
    /* двусторонняя целостность: полное зеркало (идемпотентно) + разбор очереди */
    void cloudFullPush(dbRef.current, user.id);
    void flushOutbox(dbRef.current, user.id).finally(() => setOutboxN(outboxCount()));
    const added = divergenceTotal(stats);
    toast(added > 0 ? `Объединено с облаком: добавлено ${added} строк` : "Объединено с облаком");
  };

  /** Отправить накопленную очередь неотправленных операций вручную. */
  const flushOutboxNow = async (): Promise<number> => {
    if (!user?.cloudId) return 0;
    const sent = await flushOutbox(dbRef.current, user.id);
    setOutboxN(outboxCount());
    return sent;
  };

  const sendMessage = (text: string) => {
    if (!user || !pet) return;
    const t = text.trim();
    if (!t) return;
    const d = structuredClone(db);
    d.chat.push({ id: uid(), petId: pet.id, authorId: user.id, text: t.slice(0, 500), at: Date.now() });
    commit(d);
  };

  const addEvent = (input: VetInput): string | null => {
    if (!pet) return "Сначала создайте питомца";
    if (!input.title.trim()) return "Введите название события";
    if (!input.date) return "Выберите дату";
    const d = structuredClone(db);
    d.events.push({
      id: uid(), petId: pet.id, title: input.title.trim(), kind: input.kind,
      date: input.date, time: input.time || undefined, repeat: input.repeat,
      note: input.note?.trim() || undefined,
    });
    commit(d);
    toast("Событие добавлено в вет-календарь");
    return null;
  };

  const updateEvent = (id: string, patch: Partial<VetEvent>) => {
    const d = structuredClone(db);
    const ev = d.events.find((e) => e.id === id);
    if (!ev) return;
    Object.assign(ev, patch);
    commit(d);
    toast("Событие обновлено");
  };

  const deleteEvent = (id: string) => {
    const d = structuredClone(db);
    d.events = d.events.filter((e) => e.id !== id);
    commit(d);
    toast("Событие удалено", "warn");
  };

  const setTg = (patch: Partial<TelegramCfg>) => {
    const next = { ...tg, ...patch };
    setTgState(next);
    saveTelegram(next);
  };

  const removeOwner = (ownerId: string) => {
    if (!pet) return;
    if (ownerId === user?.id) { toast("Нельзя удалить самого себя", "warn"); return; }
    if (pet.ownerIds.length <= 1) { toast("У питомца должен остаться хотя бы один хозяин", "warn"); return; }
    const d = structuredClone(db);
    const p = d.pets.find((x) => x.id === pet.id);
    if (!p) return;
    p.ownerIds = p.ownerIds.filter((x) => x !== ownerId);
    commit(d);
    toast("Хозяин удалён из списка", "warn");
  };

  const toggleNotif = () => {
    if (!("Notification" in window)) { toast("Браузер не поддерживает уведомления", "err"); return; }
    if (!notifOn) {
      Notification.requestPermission().then((p) => {
        if (p === "granted") { setNotifOn(true); saveNotif(true); toast("Уведомления включены"); }
        else toast("Браузер не дал разрешение на уведомления", "warn");
      });
    } else {
      setNotifOn(false); saveNotif(false);
      toast("Уведомления выключены", "warn");
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lapometr-data.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Данные выгружены в JSON");
  };

  const resetAll = () => {
    const photos = db.logs.map((l) => l.img).filter((i): i is string => isStorageUrl(i));
    const wipe = () => {
      ["lapometr.db.v1", "lapometr.notif.v1", "lapometr.tgsent.v1"].forEach((k) => localStorage.removeItem(k));
      sessionStorage.removeItem("lapometr.session.v1");
      sessionStorage.removeItem("lapometr.activepet.v1");
      location.reload();
    };
    if (photos.length && loadCloudConfig()) {
      toast("Стираем фото из облака…", "warn");
      Promise.race([
        cloudDeletePhotoUrls(photos),
        new Promise<number>((r) => setTimeout(() => r(0), 2500)),
      ]).catch(() => 0).finally(wipe);
    } else {
      wipe();
    }
  };

  /** Полная замена БД (загрузка снапшота из облака) */
  const replaceDb = (next: DB) => {
    lastSaved.current = JSON.stringify(next);
    saveDB(next);
    setDbBoth(next);
    if (userId && next.users.some((u) => u.id === userId)) {
      toast("Данные из облака загружены", "ok");
      return;
    }
    /* Текущего аккаунта нет в снапшоте. Так как снапшот не хранит пароли,
       пробуем войти по облачной связке (cloudId) — это делает восстановление
       на новом устройстве бесшовным. */
    const cu = cloudUserRef.current;
    const linked = cu ? next.users.find((u) => u.cloudId === cu.id) : undefined;
    if (linked) {
      setUserId(linked.id);
      saveSession(linked.id);
      toast("Данные восстановлены — вход по облачному аккаунту", "ok");
    } else {
      saveSession(null);
      setUserId(null);
      toast("В снапшоте другие аккаунты — войдите заново", "warn");
    }
  };

  const value: Ctx = {
    db, user, pet, acts, logs, owners, theme, toasts, now, notifOn,
    register, login, loginDemo, guest, logout, updateProfile, createPet, complete,
    addAct, updateAct, deleteAct, regenInvite, joinPet, removeOwner,
    setTheme, toast, dismissToast, toggleNotif, exportData, resetAll, replaceDb,
    userPets, setActivePet, chat, sendMessage,
    events, tg, setTg, addEvent, updateEvent, deleteEvent,
    cloudUser, rtStatus, syncFromCloud,
    fetchDivergence, applyMerge, flushOutboxNow, outboxN,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}
