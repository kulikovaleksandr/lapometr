import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityDef, ChatMessage, DB, IconName, LogEntry, Pet, Species, VetEvent,
} from "./types";

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
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<CloudConfig>;
    if (c?.url && c?.anonKey) return { url: c.url, anonKey: c.anonKey };
  } catch { /* повреждённый конфиг игнорируем */ }
  return null;
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

export async function cloudPush(db: DB): Promise<CloudResult<{ at: number }>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  const user = await cloudCurrentUser();
  if (!user) return { ok: false, error: "Войдите в облако, чтобы синхронизировать" };
  const now = Date.now();
  const { error } = await sb.from("sync_snapshots").upsert({
    user_id: user.id,
    data: db as unknown as Record<string, unknown>,
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
  if (!Array.isArray(d.chat)) d.chat = []; // снапшоты старых версий
  if (!Array.isArray(d.events)) d.events = [];
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

  /* 7. снапшот — резервная копия */
  const now = Date.now();
  const { error: se } = await sb.from("sync_snapshots").upsert({
    user_id: me.id,
    data: db as unknown as Record<string, unknown>,
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

export async function cloudSendDiff(db: DB, meLocalId: string, diff: RowDiff): Promise<void> {
  const sb = getClient();
  const me = db.users.find((u) => u.id === meLocalId);
  if (!sb || !me?.cloudId) return;
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
  } catch {
    /* досылка — best effort: ручной «Отправить в облако» всё покроет */
  }
}

/* ---------- вход по коду через облако ---------- */

export async function cloudClaimInvite(code: string): Promise<CloudResult<string>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  const { data, error } = await sb.rpc("claim_invite", { code: code.trim().toUpperCase() });
  if (error) return { ok: false, error: tr(error.message) };
  return { ok: true, data: String(data) };
}

export interface PetBundle {
  pet: Pet;
  acts: ActivityDef[];
  logs: LogEntry[];
  chat: ChatMessage[];
  events: VetEvent[];
}

/** Скачать питомца по id: карточка, активности, журнал, чат, события */
export async function cloudFetchPetBundle(pid: string): Promise<CloudResult<PetBundle>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Облако не подключено" };
  const [p, a, l, c, e] = await Promise.all([
    sb.from("pets").select("*").eq("id", pid).maybeSingle(),
    sb.from("activity_defs").select("*").eq("pet_id", pid),
    sb.from("logs").select("*").eq("pet_id", pid).order("at", { ascending: true }).limit(5000),
    sb.from("chat_messages").select("*").eq("pet_id", pid).order("at", { ascending: true }).limit(1000),
    sb.from("vet_events").select("*").eq("pet_id", pid),
  ]);
  if (p.error) return { ok: false, error: tr(p.error.message) };
  if (!p.data) return { ok: false, error: "Питомец не найден в облаке" };
  const row = p.data as Record<string, unknown>;
  const pet: Pet = {
    id: String(row.id),
    name: String(row.name ?? "Питомец"),
    species: (row.species as Species) ?? "cat",
    breed: String(row.breed ?? ""),
    birthday: row.birthday ? String(row.birthday).slice(0, 10) : "",
    color: String(row.color ?? "#e8a34e"),
    img: (row.avatar_url as string | null) ?? undefined,
    ownerIds: [],
    invite: String(row.invite_code ?? ""),
    createdAt: Date.parse(String(row.created_at)) || Date.now(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asAny = (x: unknown) => x as any[];
  return {
    ok: true,
    data: {
      pet,
      acts: (asAny(a.data) ?? []).map((x) => ({
        id: x.id, petId: x.pet_id, title: x.title, icon: x.icon as IconName, color: x.color,
        paws: x.paws, limitDay: x.limit_day, limitWeek: x.limit_week,
        limitMonth: x.limit_month, remindH: x.remind_hours,
        custom: x.is_custom || undefined,
      })),
      logs: (asAny(l.data) ?? []).map((x) => ({
        id: x.id, petId: x.pet_id, actId: x.act_id, ownerId: x.owner_id,
        at: Date.parse(x.at), img: x.img ?? undefined,
      })),
      chat: (asAny(c.data) ?? []).map((x) => ({
        id: x.id, petId: x.pet_id, authorId: x.author_id, text: x.text, at: Date.parse(x.at),
      })),
      events: (asAny(e.data) ?? []).map((x) => ({
        id: x.id, petId: x.pet_id, kind: x.kind, title: x.title, date: x.date,
        time: x.time ?? undefined, repeat: x.repeat, note: x.note ?? undefined,
      })),
    },
  };
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
