import type { TelegramCfg } from "./types";

const API = "https://api.telegram.org";
const SENT_KEY = "lapometr.tgsent.v1";

const loadSent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]"); } catch { return []; }
};
export const wasSent = (key: string) => loadSent().includes(key);
export const markSent = (key: string) => {
  const arr = loadSent();
  if (!arr.includes(key)) arr.push(key);
  localStorage.setItem(SENT_KEY, JSON.stringify(arr.slice(-300)));
};

const tr = (m: string) =>
  m.includes("Unauthorized") ? "Неверный токен бота"
    : m.includes("chat not found") ? "Чат не найден: напишите боту первым, проверьте chat_id"
    : m.includes("Too Many Requests") ? "Слишком много запросов — подождите минуту"
    : m;

async function call<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
  if (!json?.ok) throw new Error(tr(json?.description ?? `Сеть ответила ${res.status}`));
  return json.result as T;
}

/** Проверка токена: возвращает имя бота */
export const tgTestToken = async (token: string) => {
  const me = await call<{ username: string; first_name: string }>(token.trim(), "getMe");
  return me.first_name || me.username;
};

export const tgSend = (cfg: Pick<TelegramCfg, "botToken" | "chatId">, html: string) =>
  call(cfg.botToken.trim(), "sendMessage", {
    chat_id: cfg.chatId.trim(),
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });

/** Проверка связки токен+чат с тестовым сообщением */
export const tgTestSend = async (cfg: Pick<TelegramCfg, "botToken" | "chatId">) => {
  const name = await tgTestToken(cfg.botToken);
  await tgSend(cfg, `🐾 <b>Лапометр подключён!</b>\n\nБот «${name}» будет присылать напоминания о заботе.`);
  return name;
};
