import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DB } from "./types";

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
