import {
  createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type {
  ActivityDef, DB, IconName, LogEntry, Pet, Species, ThemeId, User,
} from "../lib/types";
import { LEVELS, genInvite, levelFor, uid } from "../lib/types";
import {
  computeDue, ensureDemo, limitsFor, loadDB, loadNotif, loadSession, loadTheme,
  loginUser, makeGuest, makePetWithActs, pawsOf, registerUser,
  saveDB, saveNotif, saveSession, saveTheme,
} from "../lib/db";

export interface Toast { id: string; text: string; kind: "ok" | "warn" | "err" | "paw" }

export interface NewActInput {
  title: string; icon: IconName; color: string; paws: number;
  limitDay: number; limitWeek: number; limitMonth: number; remindH: number;
}

interface Ctx {
  db: DB;
  user: User | null;
  pet: Pet | null;
  acts: ActivityDef[];
  logs: LogEntry[];
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
  complete: (actId: string) => void;
  addAct: (input: NewActInput) => string | null;
  updateAct: (id: string, patch: Partial<ActivityDef>) => void;
  deleteAct: (id: string) => void;
  regenInvite: () => void;
  joinPet: (code: string) => string | null;
  removeOwner: (ownerId: string) => void;
  setTheme: (t: ThemeId) => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
  toggleNotif: () => void;
  exportData: () => void;
  resetAll: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => loadDB());
  const [userId, setUserId] = useState<string | null>(() => loadSession());
  const [theme, setThemeState] = useState<ThemeId>(() => loadTheme());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [notifOn, setNotifOn] = useState(() => loadNotif());
  const lastSaved = useRef<string>("");
  const notified = useRef<Set<string>>(new Set());

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
    const onStorage = (e: StorageEvent) => { if (e.key === "lapometr.db.v1") setDb(loadDB()); };
    const onCustom = () => {
      const fresh = loadDB();
      if (JSON.stringify(fresh) !== lastSaved.current) setDb(fresh);
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
  const pet = useMemo(
    () => (user ? db.pets.find((p) => p.ownerIds.includes(user.id)) ?? null : null),
    [db, user],
  );
  const acts = useMemo(() => (pet ? db.acts.filter((a) => a.petId === pet.id) : []), [db, pet]);
  const logs = useMemo(() => (pet ? db.logs.filter((l) => l.petId === pet.id) : []), [db, pet]);
  const owners = useMemo(
    () => (pet ? pet.ownerIds.map((id) => db.users.find((u) => u.id === id)).filter(Boolean) as User[] : []),
    [db, pet],
  );

  const commit = useCallback((d: DB) => {
    lastSaved.current = JSON.stringify(d);
    saveDB(d);
    setDb(d);
  }, []);

  /* ---------- тосты ---------- */
  const toast = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = uid();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);
  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  /* ---------- браузерные уведомления ---------- */
  useEffect(() => {
    if (!notifOn || !pet || !("Notification" in window) || Notification.permission !== "granted") return;
    const check = () => {
      for (const it of computeDue(acts, logs, Date.now())) {
        if (it.overdueMin !== null && it.overdueMin > 0 && it.dueAt) {
          const key = `${it.act.id}@${it.dueAt}`;
          if (!notified.current.has(key)) {
            notified.current.add(key);
            try { new Notification("Лапометр", { body: `${pet.name}: пора «${it.act.title}»` }); } catch { /* noop */ }
          }
        }
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [notifOn, pet, acts, logs]);

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
  };

  const complete = (actId: string) => {
    if (!user || !pet) return;
    const act = acts.find((a) => a.id === actId);
    if (!act) return;
    const t = Date.now();
    const st = limitsFor(act, logs, t);
    if (st.blocked) { toast(st.blocked, "err"); return; }
    const before = pawsOf(acts, logs);
    const d = structuredClone(db);
    d.logs.push({ id: uid(), petId: pet.id, actId, ownerId: user.id, at: t });
    commit(d);
    toast(`+${act.paws} лапок: «${act.title}»`, "paw");
    if (levelFor(before + act.paws).idx > levelFor(before).idx) {
      setTimeout(() => toast(`Новый уровень заботы: «${levelFor(before + act.paws).title}»`, "ok"), 700);
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
    const d = structuredClone(db);
    d.acts = d.acts.filter((x) => x.id !== id);
    d.logs = d.logs.filter((l) => l.actId !== id);
    commit(d);
    toast("Активность удалена вместе со своими записями", "warn");
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

  const joinPet = (code: string): string | null => {
    if (!user) return "Нужна учётная запись";
    const c = code.trim().toUpperCase();
    const p = db.pets.find((x) => x.invite.toUpperCase() === c);
    if (!p) return "Код не найден — проверьте приглашение";
    if (p.ownerIds.includes(user.id)) return "Вы уже хозяин этого питомца";
    if (db.pets.some((x) => x.ownerIds.includes(user.id)))
      return "У вас уже есть питомец. Код вводится с аккаунта без питомца";
    const d = structuredClone(db);
    d.pets.find((x) => x.id === p.id)!.ownerIds.push(user.id);
    commit(d);
    toast(`Теперь вы вместе ухаживаете за ${p.name}`);
    return null;
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
    ["lapometr.db.v1", "lapometr.notif.v1"].forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem("lapometr.session.v1");
    location.reload();
  };

  const value: Ctx = {
    db, user, pet, acts, logs, owners, theme, toasts, now, notifOn,
    register, login, loginDemo, guest, logout, updateProfile, createPet, complete,
    addAct, updateAct, deleteAct, regenInvite, joinPet, removeOwner,
    setTheme, toast, dismissToast, toggleNotif, exportData, resetAll,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}
