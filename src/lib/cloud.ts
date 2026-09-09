import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityDef, ChatMessage, DB, IconName, LogEntry, Pet, Species, VetEvent,
} from "./types";
import { migrateDB } from "./db";

/**
 * Облачный слой (Supabase).
 * Локальная БД остаётся источником правды для UI; облако даёт
 * мультидевайс-синхронизацию (снапшот) и настоящую авторизацию.
 * Если проект не настроен — приложение полностью работает локально.
 */

const CFG_KEY = "lapometr.cloud.v1";
const LAST_KEY = "lapometr.cloud.last.v1";

export interface CloudConfig { url: string; anonKey: string }
export interface CloudUser { id: string; email: string | null; provider: string }
export type CloudResult<T = undefined> =
  | { ok: true; data?: T; note?: string }
  | { ok: false; error: string };

let client: SupabaseClient | null = null;
let clientSig = "";

/* ---------- конфиг ---------- */

export function loadCloudConfig(): CloudConfig | null {
  // Сначала проверяем env переменные (для продакшена)
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (envUrl && envKey) {
    return { url: envUrl.trim().replace(/\/+$/, ""), anonKey: envKey.trim() };
  }
  
  // Затем проверяем localStorage (для ручной настройки)
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<CloudConfig>;
    if (c?.url && c?.anonKey) return { url: c.url, anonKey: c.anonKey };
  } catch { /* повреждённый конфиг игнорируем */ }
  return null;
}

export function isEnvCloudConfigured(): boolean {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function saveCloudConfig(url: string, anonKey: string) {
  localStorage.setItem(CFG_KEY, JSON.stringify({ url: url.trim().replace(/\/+$/, ""), anonKey: anonKey.trim() }));
  client = null;
  clientSig = "";
}

export function clearCloudConfig() {
  localStorage.removeItem(CFG_KEY);
  localStorage.removeItem(LAST_KEY);
  client = null;
  clientSig = "";
}

export function getClient(): SupabaseClient | null {
  const cfg = loadCloudConfig();
  if (!cfg) return null;
  const sig = cfg.url + "::" + cfg.anonKey;
  if (!client || clientSig !== sig) {
    client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    clientSig = sig;
  }
  return client;
}

/* ---------- проверка связи ---------- */

export async function testConnection(urlRaw: string, anonKey: string): Promise<CloudResult> {
  const url = urlRaw.trim().replace(/\/+$/, "");
  if (!/^https:\/\/.+\.supabase\.co$/.test(url) && !/^https:\/\//.test(url)) {
    return { ok: false, error: "URL должен начинаться с https://" };
  }
  if (anonKey.trim().length < 20) {
    return { ok: false, error: "Похоже, anon key обрезан" };
  }
  try {
    const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey.trim() } });
    if (!res.ok) return { ok: false, error: `Supabase ответил ${res.status}. Проверьте URL и ключ` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось связаться с проектом. Проверьте URL и сеть" };
  }
}

/* ---------- перевод ошибок Supabase ---------- */

const ERR_MAP: [RegExp, string][] = [
  [/invalid login credentials/i, "Неверный e-mail или пароль"],
  [/already registered/i, "Такой e-mail уже зарегистрирован — войдите"],
  [/rate limit/i, "Слишком много попыток. Подождите минуту"],
  [/confirm signup/i, "Подтвердите e-mail по ссылке из письма"],
  [/invalid api key/i, "Неверный anon key"],
  [/network/i, "Нет сети"],
];
const tr = (msg: string) => ERR_MAP.find(([re]) => re.test(msg))?.[1] ?? msg;

/* ---------- авторизация ---------- */

export async function cloudSignUp(email: string, password: string, name: string): Promise<CloudResult<CloudUser>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  const { data, error } = await sb.auth.signUp({
    email: email.trim(), password, options: { data: { name: name || "Хозяин" } },
  });
  if (error) return { ok: false, error: tr(error.message) };
  if (!data.session) return { ok: true, note: "Мы отправили письмо — подтвердите e-mail, затем войдите" };
  return { ok: true, data: toUser(data.session.user?.id ?? "", data.session.user?.email, "email") };
}

export async function cloudSignIn(email: string, password: string): Promise<CloudResult<CloudUser>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: tr(error.message) };
  return { ok: true, data: toUser(data.user?.id ?? "", data.user?.email, "email") };
}

export async function cloudSignInGoogle(): Promise<CloudResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) return { ok: false, error: tr(error.message) };
  return { ok: true, note: "Перенаправляем в Google…" };
}

export async function cloudSignOut(): Promise<CloudResult> {
  const sb = getClient();
  if (sb) await sb.auth.signOut();
  return { ok: true };
}

export async function cloudCurrentUser(): Promise<CloudUser | null> {
  const sb = getClient();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    const provider = u.app_metadata?.provider === "google" ? "google" : "email";
    return toUser(u.id, u.email, provider);
  } catch {
    return null;
  }
}

export function onCloudAuthChange(cb: (u: CloudUser | null) => void): () => void {
  const sb = getClient();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_e, session) => {
    const u = session?.user;
    cb(u ? toUser(u.id, u.email, u.app_metadata?.provider === "google" ? "google" : "email") : null);
  });
  return () => data.subscription.unsubscribe();
}

const toUser = (id: string, email: string | null | undefined, provider: string): CloudUser => ({
  id, email: email ?? null, provider,
});

/* ---------- синхронизация (снапшот) ---------- */

/**
 * Гигиена снапшота: вырезаем чувствительные поля перед отправкой в облако.
 * Снапшот — резервная копия ДАННЫХ (журнал, лапки, питомцы, чат), а не
 * учётных данных: хэши паролей и e-mail никогда не покидают устройство.
 *
 * После восстановления вход идёт через облачную сессию (связка `cloudId`),
 * а e-mail текущего пользователя возвращается из сессии Supabase при
 * загрузке (см. `cloudPull`). Аватары намеренно сохраняем — это данные
 * пользователя, нужные для целостного восстановления.
 */
export function sanitizeForCloud(db: DB): DB {
  const d = structuredClone(db);
  d.users = d.users.map((u) => ({ ...u, pass: "", email: "" }));
  return d;
}

export async function cloudPush(db: DB): Promise<CloudResult<{ at: number }>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  const user = await cloudCurrentUser();
  if (!user) return { ok: false, error: "Войдите в облако, чтобы синхронизировать" };
  const now = Date.now();
  const { error } = await sb.from("sync_snapshots").upsert({
    user_id: user.id,
    data: sanitizeForCloud(db) as unknown as Record<string, unknown>,
    updated_at: new Date(now).toISOString(),
  });
  if (error) return { ok: false, error: tr(error.message) };
  localStorage.setItem(LAST_KEY, String(now));
  return { ok: true, data: { at: now } };
}

export interface CloudSnapshot { data: DB; updatedAt: number }

export async function cloudPull(): Promise<CloudResult<CloudSnapshot | null>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  const user = await cloudCurrentUser();
  if (!user) return { ok: false, error: "Войдите в облако, чтобы синхронизировать" };
  const { data, error } = await sb.from("sync_snapshots")
    .select("data, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { ok: false, error: tr(error.message) };
  if (!data?.data) return { ok: true, data: null };
  const d = data.data as DB;
  if (!Array.isArray(d.users) || !Array.isArray(d.pets) || !Array.isArray(d.logs)) {
    return { ok: false, error: "Снапшот повреждён" };
  }
  if (!Array.isArray(d.users)) d.users = [];
  migrateDB(d); // снапшоты старых версий — накатываем реестр апгрейдов

  /* гигиена: в снапшоте нет e-mail/паролей. Возвращаем e-mail текущего
     пользователя из активной облачной сессии (по связке cloudId). */
  const linked = d.users.find((u) => u.cloudId === user.id);
  if (linked && user.email) linked.email = user.email;

  return { ok: true, data: { data: d, updatedAt: Date.parse(data.updated_at) } };
}

export function lastSyncAt(): number | null {
  const v = localStorage.getItem(LAST_KEY);
  return v ? Number(v) : null;
}

/* ==================================================================
   REALTIME-СИНХРОНИЗАЦИЯ (миграция 003)
   Локальные коллекции зеркалируются в строки logs / chat_messages /
   vet_events; подписка на Postgres Changes доставляет живые записи
   на другие устройства. Снапшот остаётся резервной копией.
   ================================================================== */

export interface MirrorStats { pets: number; logs: number; chat: number; events: number }

const iso = (t: number) => new Date(t).toISOString();
const cloudIdOf = (db: DB, localId: string) =>
  db.users.find((u) => u.id === localId)?.cloudId ?? null;

/** Полное зеркало: питомцы, доступ, активности, журнал, чат, события + снапшот */
export async function cloudFullPush(db: DB, meLocalId: string): Promise<CloudResult<MirrorStats>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  const me = await cloudCurrentUser();
  if (!me) return { ok: false, error: "Войдите в облако, чтобы синхронизировать" };
  const meLocal = db.users.find((u) => u.id === meLocalId);
  if (!meLocal) return { ok: false, error: "Локальный профиль не найден" };
  const myPets = db.pets.filter((p) => p.ownerIds.includes(meLocalId));
  const petIds = myPets.map((p) => p.id);
  if (!petIds.length) return { ok: false, error: "Нет питомцев для отправки" };

  /* 1. питомцы, которых я создал (обновлять чужих запретит RLS) */
  const owned = myPets.filter((p) => p.ownerIds[0] === meLocalId);
  if (owned.length) {
    const { error } = await sb.from("pets").upsert(
      owned.map((p) => ({
        id: p.id, owner_id: me.id, name: p.name, species: p.species,
        breed: p.breed || null, birthday: p.birthday || null, color: p.color,
        avatar_url: p.img ?? null, invite_code: p.invite, created_at: iso(p.createdAt),
      })),
      { onConflict: "id" },
    );
    if (error) return { ok: false, error: tr(`питомцы: ${error.message}`) };
  }

  /* 2. мой доступ + отображаемое имя для других хозяев */
  {
    const { error } = await sb.from("cloud_access").upsert(
      myPets.map((p) => ({
        pet_id: p.id, cloud_id: me.id,
        display_name: meLocal.name, display_color: meLocal.color,
      })),
      { onConflict: "pet_id,cloud_id" },
    );
    if (error) return { ok: false, error: tr(`доступ: ${error.message}`) };
  }

  /* 2b. pet_owners: строка участия (каждый хозяин пишет только свою) */
  {
    const { error } = await sb.from("pet_owners").upsert(
      myPets.map((p) => ({ pet_id: p.id, user_id: me.id, role: "owner" })),
      { onConflict: "pet_id,user_id", ignoreDuplicates: true },
    );
    if (error) return { ok: false, error: tr(`участие: ${error.message}`) };
  }

  /* 3. активности */
  const acts = db.acts.filter((a) => petIds.includes(a.petId));
  if (acts.length) {
    const { error } = await sb.from("activity_defs").upsert(
      acts.map((a) => ({
        id: a.id, pet_id: a.petId, title: a.title, icon: a.icon, color: a.color,
        paws: a.paws, limit_day: a.limitDay, limit_week: a.limitWeek,
        limit_month: a.limitMonth, remind_hours: a.remindH, is_custom: !!a.custom,
      })),
      { onConflict: "id" },
    );
    if (error) return { ok: false, error: tr(`активности: ${error.message}`) };
  }

  /* 4. журнал — mirror-функцией (история в обход лимитов),
        только записи хозяев, связанных с облаком */
  const logs = db.logs.filter((l) => petIds.includes(l.petId) && cloudIdOf(db, l.ownerId));
  let logsN = 0;
  for (let i = 0; i < logs.length; i += 400) {
    const rows = logs.slice(i, i + 400).map((l) => ({
      id: l.id, pet_id: l.petId, act_id: l.actId,
      owner_id: cloudIdOf(db, l.ownerId)!, at: iso(l.at), img: l.img ?? null,
    }));
    const { data, error } = await sb.rpc("mirror_upsert_logs", { rows });
    if (error) return { ok: false, error: tr(`журнал: ${error.message}`) };
    logsN += Number(data ?? 0);
  }

  /* 5. чат */
  const chat = db.chat.filter((m) => petIds.includes(m.petId) && cloudIdOf(db, m.authorId));
  if (chat.length) {
    const { error } = await sb.from("chat_messages").upsert(
      chat.map((m) => ({
        id: m.id, pet_id: m.petId, author_id: cloudIdOf(db, m.authorId)!,
        text: m.text, at: iso(m.at),
      })),
      { onConflict: "id" },
    );
    if (error) return { ok: false, error: tr(`чат: ${error.message}`) };
  }

  /* 6. вет-события */
  const events = db.events.filter((e) => petIds.includes(e.petId));
  if (events.length) {
    const { error } = await sb.from("vet_events").upsert(
      events.map((e) => ({
        id: e.id, pet_id: e.petId, kind: e.kind, title: e.title, date: e.date,
        time: e.time ?? null, repeat: e.repeat, note: e.note ?? null,
      })),
      { onConflict: "id" },
    );
    if (error) return { ok: false, error: tr(`события: ${error.message}`) };
  }

  /* 7. снапшот — резервная копия (без паролей и e-mail, см. sanitizeForCloud) */
  const now = Date.now();
  const { error: se } = await sb.from("sync_snapshots").upsert({
    user_id: me.id,
    data: sanitizeForCloud(db) as unknown as Record<string, unknown>,
    updated_at: new Date(now).toISOString(),
  });
  if (se) return { ok: false, error: tr(se.message) };
  localStorage.setItem(LAST_KEY, String(now));
  return { ok: true, data: { pets: myPets.length, logs: logsN, chat: chat.length, events: events.length } };
}

/* ---------- живая досылка разницы (вызывается на каждый commit) ---------- */

export interface RowDiff {
  logs: LogEntry[];
  chat: ChatMessage[];
  events: VetEvent[];
  delEvents: string[];
}

/** Возвращает true, если все строки ушли в облако, иначе false (для outbox). */
export async function cloudSendDiff(db: DB, meLocalId: string, diff: RowDiff): Promise<boolean> {
  const sb = getClient();
  const me = db.users.find((u) => u.id === meLocalId);
  if (!sb || !me?.cloudId) return false;
  try {
    if (diff.logs.length) {
      const rows = diff.logs
        .filter((l) => cloudIdOf(db, l.ownerId))
        .map((l) => ({
          id: l.id, pet_id: l.petId, act_id: l.actId,
          owner_id: cloudIdOf(db, l.ownerId)!, at: iso(l.at), img: l.img ?? null,
        }));
      if (rows.length) await sb.rpc("mirror_upsert_logs", { rows });
    }
    if (diff.chat.length) {
      await sb.from("chat_messages").upsert(
        diff.chat
          .filter((m) => cloudIdOf(db, m.authorId))
          .map((m) => ({
            id: m.id, pet_id: m.petId, author_id: cloudIdOf(db, m.authorId)!,
            text: m.text, at: iso(m.at),
          })),
        { onConflict: "id" },
      );
    }
    if (diff.events.length) {
      await sb.from("vet_events").upsert(
        diff.events.map((e) => ({
          id: e.id, pet_id: e.petId, kind: e.kind, title: e.title, date: e.date,
          time: e.time ?? null, repeat: e.repeat, note: e.note ?? null,
        })),
        { onConflict: "id" },
      );
    }
    if (diff.delEvents.length) {
      await sb.from("vet_events").delete().in("id", diff.delEvents);
    }
    return true;
  } catch {
    return false;
  }
}

/* ---------- outbox: очередь операций, не ушедших в облако ---------- */

const OUTBOX_KEY = "lapometr.outbox.v1";
const OUTBOX_CAP = 100;

export function loadOutbox(): RowDiff[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (raw) {
      const q = JSON.parse(raw) as RowDiff[];
      if (Array.isArray(q)) return q;
    }
  } catch { /* повреждённая очередь — начинаем заново */ }
  return [];
}

const saveOutboxQueue = (q: RowDiff[]) => {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(q.slice(-OUTBOX_CAP))); }
  catch { /* переполнение localStorage — очередь не критична */ }
};

export const clearOutbox = () => localStorage.removeItem(OUTBOX_KEY);
export const outboxCount = (): number =>
  loadOutbox().reduce((n, d) => n + d.logs.length + d.chat.length + d.events.length + d.delEvents.length, 0);

/** Добавить неотправленную разницу в очередь (с дедупликацией по id). */
export function enqueueOutbox(diff: RowDiff): void {
  const q = loadOutbox();
  const hasLog = new Set(q.flatMap((d) => d.logs.map((l) => l.id)));
  const hasChat = new Set(q.flatMap((d) => d.chat.map((m) => m.id)));
  const hasEv = new Set(q.flatMap((d) => d.events.map((e) => e.id)));
  const hasDel = new Set(q.flatMap((d) => d.delEvents));
  const merged: RowDiff = {
    logs: diff.logs.filter((l) => !hasLog.has(l.id)),
    chat: diff.chat.filter((m) => !hasChat.has(m.id)),
    events: diff.events.filter((e) => !hasEv.has(e.id)),
    delEvents: diff.delEvents.filter((id) => !hasDel.has(id)),
  };
  if (merged.logs.length || merged.chat.length || merged.events.length || merged.delEvents.length) {
    q.push(merged);
    saveOutboxQueue(q);
  }
}

/**
 * Отправить накопленную очередь. Успешные операции удаляются,
 * неудачные остаются до следующей попытки. Возвращает число отправленных строк.
 */
export async function flushOutbox(db: DB, meLocalId: string): Promise<number> {
  const q = loadOutbox();
  if (!q.length) return 0;
  let sent = 0;
  const rest: RowDiff[] = [];
  for (const diff of q) {
    const ok = await cloudSendDiff(db, meLocalId, diff);
    if (ok) sent += diff.logs.length + diff.chat.length + diff.events.length + diff.delEvents.length;
    else rest.push(diff);
  }
  if (rest.length) saveOutboxQueue(rest);
  else clearOutbox();
  return sent;
}

/* ---------- вход по коду через облако ---------- */

export async function cloudClaimInvite(code: string): Promise<CloudResult<string>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  const { data, error } = await sb.rpc("claim_invite", { code: code.trim().toUpperCase() });
  if (error) return { ok: false, error: tr(error.message) };
  return { ok: true, data: String(data) };
}

/* ---------- мапперы строк → доменные объекты ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const rowToPet = (r: Row): Pet => ({
  id: String(r.id),
  name: String(r.name ?? "Питомец"),
  species: (r.species as Species) ?? "cat",
  breed: String(r.breed ?? ""),
  birthday: r.birthday ? String(r.birthday).slice(0, 10) : "",
  color: String(r.color ?? "#e8a34e"),
  img: (r.avatar_url as string | null) ?? undefined,
  ownerIds: [],
  invite: String(r.invite_code ?? ""),
  createdAt: Date.parse(String(r.created_at)) || Date.now(),
});

const rowToAct = (r: Row): ActivityDef => ({
  id: r.id, petId: r.pet_id, title: r.title, icon: r.icon as IconName, color: r.color,
  paws: r.paws, limitDay: r.limit_day, limitWeek: r.limit_week,
  limitMonth: r.limit_month, remindH: r.remind_hours,
  custom: r.is_custom || undefined,
});

const rowToLog = (r: Row): LogEntry => ({
  id: r.id, petId: r.pet_id, actId: r.act_id, ownerId: r.owner_id,
  at: Date.parse(r.at), img: r.img ?? undefined,
});

const rowToChat = (r: Row): ChatMessage => ({
  id: r.id, petId: r.pet_id, authorId: r.author_id, text: r.text, at: Date.parse(r.at),
});

const rowToEvent = (r: Row): VetEvent => ({
  id: r.id, petId: r.pet_id, kind: r.kind, title: r.title, date: r.date,
  time: r.time ?? undefined, repeat: r.repeat, note: r.note ?? undefined,
});

/** Постраничная выборка: PostgREST отдаёт не более 1000 строк за запрос */
async function paged(sb: SupabaseClient, table: string, petIds: string[]): Promise<Row[]> {
  const PAGE = 1000;
  const out: Row[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select("*")
      .in("pet_id", petIds)
      .order("at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(tr(error.message));
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export interface PetBundle {
  pet: Pet;
  acts: ActivityDef[];
  logs: LogEntry[];
  chat: ChatMessage[];
  events: VetEvent[];
  /** cloud id всех участников (pet_owners + cloud_access) */
  memberIds: string[];
}

/** Скачать питомца по id: карточка, участники, активности, журнал, чат, события */
export async function cloudFetchPetBundle(pid: string): Promise<CloudResult<PetBundle>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  try {
    const [p, po, ca, a, l, c, e] = await Promise.all([
      sb.from("pets").select("*").eq("id", pid).maybeSingle(),
      sb.from("pet_owners").select("user_id").eq("pet_id", pid),
      sb.from("cloud_access").select("cloud_id").eq("pet_id", pid),
      sb.from("activity_defs").select("*").eq("pet_id", pid),
      paged(sb, "logs", [pid]),
      paged(sb, "chat_messages", [pid]),
      sb.from("vet_events").select("*").eq("pet_id", pid),
    ]);
    if (p.error) return { ok: false, error: tr(p.error.message) };
    if (!p.data) return { ok: false, error: "Питомец не найден в облаке" };
    const memberIds = [
      ...new Set([
        ...(po.data ?? []).map((r) => String(r.user_id)),
        ...(ca.data ?? []).map((r) => String(r.cloud_id)),
      ]),
    ];
    return {
      ok: true,
      data: {
        pet: rowToPet(p.data),
        acts: (a.data ?? []).map(rowToAct),
        logs: l.map(rowToLog),
        chat: c.map(rowToChat),
        events: (e.data ?? []).map(rowToEvent),
        memberIds,
      },
    };
  } catch (err) {
    return { ok: false, error: tr(err instanceof Error ? err.message : String(err)) };
  }
}

/* ---------- построчная синхронизация всех питомцев ---------- */

export interface RemoteRows {
  pets: Pet[];
  acts: ActivityDef[];
  logs: LogEntry[];
  chat: ChatMessage[];
  events: VetEvent[];
  /** pet id → cloud id участников */
  membersByPet: Record<string, string[]>;
  /** cloud id → отображаемое имя/цвет */
  displays: Record<string, { name: string; color: string }>;
}

/** Скачать все строки по питомцам, где я создатель или участник */
export async function cloudRowFetch(meCloudId: string): Promise<CloudResult<RemoteRows>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  const empty: RemoteRows = { pets: [], acts: [], logs: [], chat: [], events: [], membersByPet: {}, displays: {} };
  try {
    /* мои питомцы: созданные мной + те, где я участник */
    const { data: acc, error: e1 } = await sb.from("cloud_access")
      .select("pet_id").eq("cloud_id", meCloudId);
    if (e1) return { ok: false, error: tr(e1.message) };
    const accessIds = [...new Set((acc ?? []).map((r) => String(r.pet_id)))];
    const filter = accessIds.length
      ? `owner_id.eq.${meCloudId},id.in.(${accessIds.join(",")})`
      : `owner_id.eq.${meCloudId}`;
    const { data: petRows, error: e2 } = await sb.from("pets").select("*").or(filter);
    if (e2) return { ok: false, error: tr(e2.message) };
    const pets = (petRows ?? []).map(rowToPet);
    if (!pets.length) return { ok: true, data: empty };
    const petIds = pets.map((p) => p.id);

    const [po, ca, a, l, c, ev] = await Promise.all([
      sb.from("pet_owners").select("pet_id, user_id").in("pet_id", petIds),
      sb.from("cloud_access").select("pet_id, cloud_id, display_name, display_color").in("pet_id", petIds),
      sb.from("activity_defs").select("*").in("pet_id", petIds),
      paged(sb, "logs", petIds),
      paged(sb, "chat_messages", petIds),
      sb.from("vet_events").select("*").in("pet_id", petIds),
    ]);

    const membersByPet: Record<string, string[]> = {};
    for (const pid of petIds) membersByPet[pid] = [];
    (po.data ?? []).forEach((r) => {
      const pid = String(r.pet_id);
      if (membersByPet[pid] && !membersByPet[pid].includes(String(r.user_id))) membersByPet[pid].push(String(r.user_id));
    });
    const displays: Record<string, { name: string; color: string }> = {};
    (ca.data ?? []).forEach((r) => {
      const pid = String(r.pet_id);
      const cid = String(r.cloud_id);
      if (membersByPet[pid] && !membersByPet[pid].includes(cid)) membersByPet[pid].push(cid);
      if (!displays[cid]) displays[cid] = { name: r.display_name || "Хозяин", color: r.display_color || "#8fb7c9" };
    });

    return {
      ok: true,
      data: {
        pets,
        acts: (a.data ?? []).map(rowToAct),
        logs: l.map(rowToLog),
        chat: c.map(rowToChat),
        events: (ev.data ?? []).map(rowToEvent),
        membersByPet,
        displays,
      },
    };
  } catch (err) {
    return { ok: false, error: tr(err instanceof Error ? err.message : String(err)) };
  }
}

export interface MergeStats {
  pets: number; acts: number; logs: number; chat: number; events: number; owners: number;
}

/**
 * Построчное слияние облачных строк в локальную БД.
 * Стратегия: объединение по id — недостающие строки добавляются,
 * существующие локальные не затираются (журнал и чат append-only,
 * правки активностей/событий уже доставляются Realtime). Идемпотентно.
 */
export function mergeRemoteRows(
  local: DB, remote: RemoteRows, meLocalId: string, meCloudId: string,
): { db: DB; stats: MergeStats } {
  const d = structuredClone(local);
  const stats: MergeStats = { pets: 0, acts: 0, logs: 0, chat: 0, events: 0, owners: 0 };

  /* cloud id → локальный id (создаёт «тень» удалённого хозяина при необходимости) */
  const resolve = (cid: string): string => {
    const known = d.users.find((u) => u.cloudId === cid || u.id === cid);
    if (known) return known.id;
    if (cid === meCloudId) return meLocalId;
    const disp = remote.displays[cid];
    d.users.push({
      id: cid, email: "", name: disp?.name ?? "Хозяин", pass: "",
      color: disp?.color ?? "#8fb7c9", createdAt: Date.now(), cloudId: cid,
    });
    stats.owners++;
    return cid;
  };

  for (const rp of remote.pets) {
    const memberIds = [...new Set([...(remote.membersByPet[rp.id] ?? []), meCloudId])].map(resolve);
    const localPet = d.pets.find((p) => p.id === rp.id);
    if (!localPet) {
      d.pets.push({ ...rp, ownerIds: memberIds });
      stats.pets++;
    } else {
      for (const oid of memberIds) {
        if (!localPet.ownerIds.includes(oid)) { localPet.ownerIds.push(oid); stats.owners++; }
      }
    }
  }

  const hasAct = new Set(d.acts.map((a) => a.id));
  for (const a of remote.acts) {
    if (!hasAct.has(a.id) && d.pets.some((p) => p.id === a.petId)) { d.acts.push(a); stats.acts++; }
  }

  const hasLog = new Set(d.logs.map((l) => l.id));
  for (const l of remote.logs) {
    if (!hasLog.has(l.id)) { d.logs.push({ ...l, ownerId: resolve(l.ownerId) }); stats.logs++; }
  }

  const hasChat = new Set(d.chat.map((m) => m.id));
  for (const m of remote.chat) {
    if (!hasChat.has(m.id)) { d.chat.push({ ...m, authorId: resolve(m.authorId) }); stats.chat++; }
  }

  const hasEv = new Set(d.events.map((e) => e.id));
  for (const e of remote.events) {
    if (!hasEv.has(e.id) && d.pets.some((p) => p.id === e.petId)) { d.events.push(e); stats.events++; }
  }

  return { db: d, stats };
}

/* ---------- детекция расхождений (двусторонняя) ---------- */

export interface Divergence {
  /** облако → локально: будет добавлено при слиянии */
  incoming: MergeStats;
  /** локально → облако: ещё не отправлено */
  outgoing: MergeStats;
}

export const divergenceTotal = (s: MergeStats): number =>
  s.pets + s.acts + s.logs + s.chat + s.events + s.owners;

/**
 * Сравнивает локальную БД с облачными строками и находит расхождения в обе
 * стороны, не выполняя слияния. Используется для merge-диалога.
 */
export function computeDivergence(
  local: DB, remote: RemoteRows, meLocalId: string,
): Divergence {
  const localPetIds = new Set(local.pets.map((p) => p.id));
  const localActIds = new Set(local.acts.map((a) => a.id));
  const localLogIds = new Set(local.logs.map((l) => l.id));
  const localChatIds = new Set(local.chat.map((m) => m.id));
  const localEventIds = new Set(local.events.map((e) => e.id));

  const incoming: MergeStats = {
    pets: remote.pets.filter((p) => !localPetIds.has(p.id)).length,
    acts: remote.acts.filter((a) => !localActIds.has(a.id)).length,
    logs: remote.logs.filter((l) => !localLogIds.has(l.id)).length,
    chat: remote.chat.filter((c) => !localChatIds.has(c.id)).length,
    events: remote.events.filter((e) => !localEventIds.has(e.id)).length,
    owners: 0,
  };

  const myPetIds = new Set(
    local.pets.filter((p) => p.ownerIds.includes(meLocalId)).map((p) => p.id),
  );
  const remoteActIds = new Set(remote.acts.map((a) => a.id));
  const remoteLogIds = new Set(remote.logs.map((l) => l.id));
  const remoteChatIds = new Set(remote.chat.map((m) => m.id));
  const remoteEventIds = new Set(remote.events.map((e) => e.id));

  const outgoing: MergeStats = {
    pets: 0,
    acts: local.acts.filter((a) => myPetIds.has(a.petId) && !remoteActIds.has(a.id)).length,
    logs: local.logs.filter((l) => myPetIds.has(l.petId) && !remoteLogIds.has(l.id)).length,
    chat: local.chat.filter((c) => myPetIds.has(c.petId) && !remoteChatIds.has(c.id)).length,
    events: local.events.filter((e) => myPetIds.has(e.petId) && !remoteEventIds.has(e.id)).length,
    owners: 0,
  };

  return { incoming, outgoing };
}

/** Отображаемые имена/цвета хозяев по их cloud id (из cloud_access) */
export async function cloudFetchDisplays(
  cloudIds: string[],
): Promise<Record<string, { name: string; color: string }>> {
  const out: Record<string, { name: string; color: string }> = {};
  const sb = getClient();
  if (!sb || !cloudIds.length) return out;
  const { data } = await sb.from("cloud_access")
    .select("cloud_id, display_name, display_color")
    .in("cloud_id", [...new Set(cloudIds)]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data ?? []).forEach((r: any) => {
    out[String(r.cloud_id)] = {
      name: r.display_name || "Хозяин",
      color: r.display_color || "#8fb7c9",
    };
  });
  return out;
}

/** Отметиться в cloud_access именем/цветом, чтобы соперники видели, кто есть кто */
export async function cloudTouchAccess(petId: string, name: string, color: string): Promise<void> {
  const sb = getClient();
  const me = await cloudCurrentUser();
  if (!sb || !me) return;
  try {
    await sb.from("cloud_access").upsert(
      { pet_id: petId, cloud_id: me.id, display_name: name, display_color: color },
      { onConflict: "pet_id,cloud_id" },
    );
  } catch { /* не критично: имя подтянется при полной отправке */ }
}

/* ==================================================================
   STORAGE: фотографии записей (миграция 004, бакет pet-photos)
   Путь объекта: {pet_id}/{log_id}.jpg
   ================================================================== */

const BUCKET = "pet-photos";

function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: m[1] });
}

export const photoStoragePath = (petId: string, logId: string) => `${petId}/${logId}.jpg`;

/** true, если img — уже ссылка в Storage (а не base64 на устройстве) */
export const isStorageUrl = (img?: string | null) => !!img && !img.startsWith("data:");

/** Загрузить фото; вернуть публичный URL или null */
export async function cloudUploadPhoto(
  petId: string, logId: string, dataUrl: string,
): Promise<string | null> {
  const sb = getClient();
  if (!sb) return null;
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;
  const path = photoStoragePath(petId, logId);
  try {
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: true,
    });
    if (error) return null;
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

function storagePathFromUrl(url: string): string | null {
  const i = url.indexOf(`/${BUCKET}/`);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + BUCKET.length + 2));
}

/** Удалить фото по публичным URL; вернуть число удалённых */
export async function cloudDeletePhotoUrls(urls: string[]): Promise<number> {
  const sb = getClient();
  if (!sb) return 0;
  const paths = [...new Set(
    urls.map(storagePathFromUrl).filter((p): p is string => !!p),
  )];
  if (!paths.length) return 0;
  try {
    const { error } = await sb.storage.from(BUCKET).remove(paths);
    return error ? 0 : paths.length;
  } catch {
    return 0;
  }
}

/** Доступен ли бакет (накатана ли миграция 004) */
export async function cloudStorageOk(): Promise<boolean> {
  const sb = getClient();
  if (!sb) return false;
  try {
    const { data } = await sb.storage.getBucket(BUCKET);
    return !!data;
  } catch {
    return false;
  }
}

/** Живой upsert одной строки журнала (например, после замены base64 на URL) */
export async function cloudUpsertLogRow(db: DB, log: LogEntry): Promise<void> {
  const sb = getClient();
  if (!sb) return;
  const owner = db.users.find((u) => u.id === log.ownerId);
  if (!owner?.cloudId) return;
  try {
    await sb.rpc("mirror_upsert_logs", {
      rows: [{
        id: log.id, pet_id: log.petId, act_id: log.actId,
        owner_id: owner.cloudId, at: iso(log.at), img: log.img ?? null,
      }],
    });
  } catch {
    /* best effort: покроется ручной полной отправкой */
  }
}

/* ---------- подписка на живые изменения ---------- */

export type RtStatus = "off" | "connecting" | "live";
export interface RtPayload {
  eventType: "INSERT" | "UPDATE" | "DELETE" | string;
  table: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old: any;
}

export function subscribeRealtime(
  onPayload: (p: RtPayload) => void,
  onStatus: (s: RtStatus) => void,
): () => void {
  const sb = getClient();
  if (!sb) { onStatus("off"); return () => {}; }
  onStatus("connecting");
  const ch = sb.channel("lapometr-rt");
  (["logs", "chat_messages", "vet_events"] as const).forEach((table) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ch as any).on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => onPayload({ eventType: p.eventType, table, new: p.new, old: p.old }),
    );
  });
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") onStatus("live");
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onStatus("off");
    else onStatus("connecting");
  });
  return () => { Promise.resolve(sb.removeChannel(ch)).catch(() => undefined); };
}
