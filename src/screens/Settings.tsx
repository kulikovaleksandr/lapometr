import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import {
  clearCloudConfig, cloudCurrentUser, cloudPull, cloudPush, cloudSignIn,
  cloudSignInGoogle, cloudSignOut, cloudSignUp, lastSyncAt, loadCloudConfig,
  onCloudAuthChange, saveCloudConfig, testConnection,
  type CloudSnapshot, type CloudUser,
} from "../lib/cloud";
import { Btn, Field, Modal, Reveal, UserAvatar, cx, inputCls } from "../components/ui";
import { Icon } from "../components/icons";
import { ACT_COLORS, ACT_ICONS, AVATAR_COLORS } from "../lib/data";
import { fileToAvatar, plural } from "../lib/db";
import type { ActivityDef, IconName } from "../lib/types";
import { THEMES } from "../lib/types";

const remindLabel = (h: number) =>
  h === 0 ? "выключено"
    : h < 24 ? `раз в ${h} ч`
    : h === 24 ? "раз в сутки"
    : h < 168 ? `раз в ${Math.round(h / 24)} сут`
    : h === 168 ? "раз в неделю"
    : h < 720 ? `раз в ${Math.round(h / 168)} нед`
    : "раз в месяц";

const limitSummary = (a: ActivityDef) => {
  const p: string[] = [];
  if (a.limitDay) p.push(`${a.limitDay}/день`);
  if (a.limitWeek) p.push(`${a.limitWeek}/нед`);
  if (a.limitMonth) p.push(`${a.limitMonth}/мес`);
  return p.length ? p.join(" · ") : "без лимитов";
};

export function SettingsScreen({ onCopy }: { onCopy: (code: string) => void }) {
  const {
    user, pet, owners, acts, theme, setTheme, notifOn, toggleNotif,
    updateProfile, regenInvite, joinPet, removeOwner, addAct, updateAct, deleteAct,
    exportData, resetAll, toast,
  } = useApp();

  const [name, setName] = useState(user?.name ?? "");
  const [color, setColor] = useState(user?.color ?? AVATAR_COLORS[0]);
  const [img, setImg] = useState<string | undefined>(user?.img);
  const [joinCode, setJoinCode] = useState("");
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<ActivityDef | "new" | null>(null);
  const [delAsk, setDelAsk] = useState<string | null>(null);
  const [resetAsk, setResetAsk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const tryJoin = () => {
    const r = joinPet(joinCode);
    setJoinErr(r);
    if (!r) setJoinCode("");
  };

  return (
    <div className="space-y-5">
      <header className="anim-fadeup">
        <p className="font-display text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">под себя</p>
        <h1 className="mt-1 font-display text-[26px] font-extrabold tracking-tight sm:text-[30px]">Настройки</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---- Профиль ---- */}
        <Reveal>
          <section className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-display text-[16px] font-bold">
              <Icon name="users" size={18} className="text-accent" />Профиль
            </h3>
            <div className="flex items-center gap-4">
              <UserAvatar user={{ ...user, name: name || "?", color, img }} size={64} />
              <div className="flex-1 space-y-2.5">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" />
                <Btn variant="soft" size="sm" onClick={() => fileRef.current?.click()}>
                  <Icon name="camera" size={15} />{img ? "Заменить фото" : "Загрузить фото"}
                </Btn>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) fileToAvatar(f).then(setImg).catch(() => toast("Не удалось прочитать файл", "err")); }} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={c}
                  className={cx("h-8 w-8 rounded-full transition-all", color === c && "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface")}
                  style={{ background: c }} />
              ))}
            </div>
            <Btn className="mt-4" onClick={() => updateProfile({ name: name.trim() || user.name, color, img })}>
              <Icon name="check" size={16} />Сохранить профиль
            </Btn>
          </section>
        </Reveal>

        {/* ---- Темы ---- */}
        <Reveal delay={70}>
          <section className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-display text-[16px] font-bold">
              <Icon name="spark" size={18} className="text-accent" />Тема оформления
            </h3>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => setTheme(t.id)}
                  className={cx(
                    "flex items-center gap-2.5 rounded-xl border p-3 transition-all hover:-translate-y-0.5",
                    theme === t.id ? "border-accent bg-accent-soft" : "border-line hover:border-mute",
                  )}>
                  <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10" style={{ background: t.bg }}>
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.swatch }} />
                    {theme === t.id && <Icon name="check" size={12} className="absolute text-ink" />}
                  </span>
                  <span className="text-[13px] font-bold">{t.name}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-mute">Выбор сохраняется и переживает перезагрузку</p>
          </section>
        </Reveal>

        {/* ---- Хозяева ---- */}
        <Reveal>
          <section className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-display text-[16px] font-bold">
              <Icon name="heart" size={18} className="text-accent" />Хозяева питомца
            </h3>
            <ul className="space-y-2">
              {owners.map((o) => (
                <li key={o.id} className="flex items-center gap-3 rounded-xl border border-line/70 bg-bg2/50 px-3 py-2.5">
                  <UserAvatar user={o} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold">{o.name}{o.id === user.id && <span className="ml-1.5 text-[12px] text-mute">· вы</span>}</span>
                    <span className="block truncate text-[12px] text-mute">{o.email}</span>
                  </span>
                  {o.id !== user.id && (
                    <Btn variant="danger" size="sm" onClick={() => removeOwner(o.id)}><Icon name="x" size={14} />убрать</Btn>
                  )}
                </li>
              ))}
            </ul>

            {pet && (
              <div className="mt-4 rounded-xl border border-dashed border-accent/50 bg-accent-soft/50 p-4">
                <p className="text-[12px] font-bold uppercase tracking-wider text-mute">Код приглашения</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <span className="font-display text-[20px] font-extrabold tracking-[0.08em] text-accent">{pet.invite}</span>
                  <div className="ml-auto flex gap-2">
                    <Btn size="sm" onClick={() => onCopy(pet.invite)}><Icon name="copy" size={14} />Копировать</Btn>
                    <Btn size="sm" variant="soft" onClick={regenInvite}><Icon name="spark" size={14} /></Btn>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <Field label="Ввести код приглашения (для аккаунта без питомца)">
                <div className="flex gap-2">
                  <input className={cx(inputCls, "flex-1")} value={joinCode} onChange={(e) => { setJoinCode(e.target.value); setJoinErr(null); }} placeholder="PAW-XXXX" />
                  <Btn onClick={tryJoin} disabled={!joinCode.trim()}>Войти в стаю</Btn>
                </div>
              </Field>
              {joinErr && <p className="anim-fade mt-2 text-[12.5px] font-medium text-danger">{joinErr}</p>}
            </div>
          </section>
        </Reveal>

        {/* ---- Напоминания ---- */}
        <Reveal delay={70}>
          <section className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-display text-[16px] font-bold">
              <Icon name="bell" size={18} className="text-accent" />Напоминания
            </h3>
            <button onClick={toggleNotif} className="flex w-full items-center gap-3 rounded-xl border border-line bg-bg2/50 px-4 py-3 text-left transition hover:border-mute">
              <span className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", notifOn ? "bg-accent" : "bg-line")}>
                <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all", notifOn ? "left-[22px]" : "left-0.5")} />
              </span>
              <span className="flex-1">
                <span className="block text-[13.5px] font-bold">Уведомления браузера</span>
                <span className="block text-[12px] text-mute">«Пора покормить» прямо в системных уведомлениях</span>
              </span>
              <Icon name={notifOn ? "check" : "x"} size={17} className={notifOn ? "text-ok" : "text-mute"} />
            </button>
            <p className="mt-3 text-[12px] leading-relaxed text-mute">
              Интервал «раз в N часов» настраивается у каждой активности ниже.
              Список «пора позаботиться» живёт на главном экране.
            </p>
          </section>
        </Reveal>

        {/* ---- Облако и синхронизация ---- */}
        <div className="lg:col-span-2">
          <CloudPanel />
        </div>
      </div>

      {/* ---- Активности ---- */}
      <Reveal>
        <section className="card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-display text-[16px] font-bold">
              <Icon name="paw" size={18} className="text-accent" />Активности, лапки и лимиты
            </h3>
            <Btn size="sm" onClick={() => setEdit("new")}><Icon name="plus" size={15} />Своя активность</Btn>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {acts.map((a) => (
              <div key={a.id} className="group flex items-center gap-3 rounded-xl border border-line/70 bg-bg2/50 px-3 py-2.5 transition hover:border-line hover:bg-raise">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${a.color} 20%, transparent)`, color: a.color }}>
                  <Icon name={a.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[13.5px] font-bold">
                    <span className="truncate">{a.title}</span>
                    {a.custom && <span className="shrink-0 rounded-md bg-raise px-1.5 py-0.5 text-[10.5px] font-bold text-mute">своя</span>}
                  </span>
                  <span className="block text-[11.5px] font-medium text-mute">
                    +{a.paws} лапок · {limitSummary(a)} · {a.remindH > 0 ? remindLabel(a.remindH) : "без напоминания"}
                  </span>
                </span>
                <button onClick={() => setEdit(a)} className="rounded-lg p-2 text-mute transition hover:bg-surface hover:text-ink" aria-label="Редактировать">
                  <Icon name="edit" size={16} />
                </button>
                {delAsk === a.id ? (
                  <Btn variant="danger" size="sm" onClick={() => { deleteAct(a.id); setDelAsk(null); }}>Точно?</Btn>
                ) : (
                  <button
                    onClick={() => { setDelAsk(a.id); setTimeout(() => setDelAsk((v) => (v === a.id ? null : v)), 2600); }}
                    className="rounded-lg p-2 text-mute transition hover:bg-danger/12 hover:text-danger" aria-label="Удалить"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ---- Данные ---- */}
      <Reveal>
        <section className="card flex flex-wrap items-center gap-3 p-6">
          <h3 className="mr-auto flex items-center gap-2 font-display text-[16px] font-bold">
            <Icon name="download" size={18} className="text-accent" />Данные
          </h3>
          <Btn variant="outline" onClick={exportData}><Icon name="download" size={16} />Экспорт JSON</Btn>
          <Btn variant="danger" onClick={() => setResetAsk(true)}><Icon name="trash" size={16} />Сбросить всё</Btn>
        </section>
      </Reveal>

      {/* ---- Модалка активности ---- */}
      {edit && (
        <ActEditor
          def={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSave={(v, isNew) => {
            if (isNew) { const r = addAct(v); if (r) return r; }
            else updateAct((edit as ActivityDef).id, v);
            setEdit(null);
            return null;
          }}
        />
      )}

      {/* ---- Подтверждение сброса ---- */}
      <Modal open={resetAsk} onClose={() => setResetAsk(false)} title="Сбросить все данные?">
        <p className="text-[13.5px] leading-relaxed text-mute">
          Будут удалены все аккаунты, питомцы, журналы и настройки в этом браузере.
          Действие необратимо — сначала сделайте экспорт JSON.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Btn variant="ghost" onClick={() => setResetAsk(false)}>Отмена</Btn>
          <Btn variant="danger" onClick={resetAll}><Icon name="trash" size={16} />Удалить всё</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ============ Редактор активности ============ */
function ActEditor({ def, onClose, onSave }: {
  def: ActivityDef | null;
  onClose: () => void;
  onSave: (v: { title: string; icon: IconName; color: string; paws: number; limitDay: number; limitWeek: number; limitMonth: number; remindH: number }, isNew: boolean) => string | null;
}) {
  const [title, setTitle] = useState(def?.title ?? "");
  const [icon, setIcon] = useState<IconName>(def?.icon ?? "paw");
  const [color, setColor] = useState(def?.color ?? ACT_COLORS[0]);
  const [paws, setPaws] = useState(String(def?.paws ?? 5));
  const [limitDay, setLimitDay] = useState(String(def?.limitDay ?? 0));
  const [limitWeek, setLimitWeek] = useState(String(def?.limitWeek ?? 0));
  const [limitMonth, setLimitMonth] = useState(String(def?.limitMonth ?? 0));
  const [remindH, setRemindH] = useState(String(def?.remindH ?? 0));
  const [err, setErr] = useState<string | null>(null);

  const num = (s: string) => Math.max(0, Math.round(Number(s) || 0));

  return (
    <Modal open onClose={onClose} title={def ? "Настроить активность" : "Новая активность"} w="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `color-mix(in oklab, ${color} 22%, transparent)`, color }}>
            <Icon name={icon} size={22} />
          </span>
          <input className={cx(inputCls, "flex-1")} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Почистить зубы" autoFocus />
        </div>

        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">Иконка</span>
          <div className="flex flex-wrap gap-1.5">
            {ACT_ICONS.map((i) => (
              <button key={i} onClick={() => setIcon(i)} aria-label={i}
                className={cx("inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all", icon === i ? "border-accent bg-accent-soft text-accent" : "border-line text-mute hover:text-ink")}>
                <Icon name={i} size={17} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">Цвет</span>
          <div className="flex flex-wrap gap-2">
            {ACT_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} aria-label={c}
                className={cx("h-8 w-8 rounded-full transition-all", color === c && "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface")}
                style={{ background: c }} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Лапки" hint="баллы за выполнение">
            <input className={inputCls} type="number" min={1} max={50} value={paws} onChange={(e) => setPaws(e.target.value)} />
          </Field>
          <Field label="Лимит/день" hint="0 — нет">
            <input className={inputCls} type="number" min={0} value={limitDay} onChange={(e) => setLimitDay(e.target.value)} />
          </Field>
          <Field label="Лимит/нед" hint="0 — нет">
            <input className={inputCls} type="number" min={0} value={limitWeek} onChange={(e) => setLimitWeek(e.target.value)} />
          </Field>
          <Field label="Лимит/мес" hint="0 — нет">
            <input className={inputCls} type="number" min={0} value={limitMonth} onChange={(e) => setLimitMonth(e.target.value)} />
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">Напоминание: раз в N часов (0 — выключено)</span>
          <div className="flex flex-wrap items-center gap-2">
            <input className={cx(inputCls, "w-24")} type="number" min={0} value={remindH} onChange={(e) => setRemindH(e.target.value)} />
            {[{ v: 8, l: "8 ч" }, { v: 12, l: "12 ч" }, { v: 24, l: "сутки" }, { v: 48, l: "2 сут" }, { v: 168, l: "неделя" }, { v: 720, l: "месяц" }].map((q) => (
              <button key={q.v} onClick={() => setRemindH(String(q.v))}
                className={cx("rounded-full border px-2.5 py-1 text-[12px] font-bold transition", remindH === String(q.v) ? "border-accent bg-accent-soft text-accent" : "border-line text-mute hover:text-ink")}>
                {q.l}
              </button>
            ))}
          </div>
        </div>

        {err && <p className="anim-fade text-[13px] font-medium text-danger">{err}</p>}

        <div className="flex justify-end gap-2.5 pt-1">
          <Btn variant="ghost" onClick={onClose}>Отмена</Btn>
          <Btn
            onClick={() => {
              const r = onSave({
                title, icon, color,
                paws: Math.max(1, Math.min(50, num(paws) || 5)),
                limitDay: num(limitDay), limitWeek: num(limitWeek), limitMonth: num(limitMonth),
                remindH: num(remindH),
              }, !def);
              setErr(r);
            }}
          >
            <Icon name="check" size={16} />Сохранить
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ================= Облако и синхронизация ================= */

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.7 1.22 9.2 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.5 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function CloudPanel() {
  const { db, replaceDb, toast, user } = useApp();
  const [cfg, setCfg] = useState(() => loadCloudConfig());
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [url, setUrl] = useState(cfg?.url ?? "");
  const [key, setKey] = useState(cfg?.anonKey ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [lastSync, setLastSync] = useState<number | null>(() => lastSyncAt());
  const [pullAsk, setPullAsk] = useState<CloudSnapshot | null>(null);

  useEffect(() => {
    let alive = true;
    if (loadCloudConfig()) cloudCurrentUser().then((u) => { if (alive) setCloudUser(u); });
    const un = onCloudAuthChange((u) => { if (alive) setCloudUser(u); });
    return () => { alive = false; un(); };
  }, [cfg]);

  const connect = async () => {
    setBusy("connect"); setErr(null);
    const r = await testConnection(url, key);
    setBusy(null);
    if (!r.ok) { setErr(r.error); return; }
    saveCloudConfig(url, key);
    setCfg(loadCloudConfig());
    toast("Облако подключено — войдите в аккаунт", "ok");
  };

  const disconnect = async () => {
    await cloudSignOut();
    clearCloudConfig();
    setCfg(null); setCloudUser(null); setUrl(""); setKey(""); setLastSync(null);
    toast("Облако отключено, данные остались на устройстве", "warn");
  };

  const auth = async () => {
    if (!email.trim() || !pass) { setErr("Введите e-mail и пароль"); return; }
    setBusy("auth"); setErr(null);
    const r = mode === "in" ? await cloudSignIn(email, pass) : await cloudSignUp(email, pass, user?.name ?? "");
    setBusy(null);
    if (!r.ok) { setErr(r.error); return; }
    if (r.note) { toast(r.note, "warn"); return; }
    const u = await cloudCurrentUser();
    setCloudUser(u);
    if (u) toast(`Облачный вход: ${u.email ?? "ок"}`, "ok");
  };

  const google = async () => {
    setBusy("google"); setErr(null);
    const r = await cloudSignInGoogle();
    setBusy(null);
    if (!r.ok) setErr(r.error);
  };

  const doPush = async () => {
    setBusy("push"); setErr(null);
    const r = await cloudPush(db);
    setBusy(null);
    if (!r.ok) { setErr(r.error); return; }
    setLastSync(r.data?.at ?? Date.now());
    toast("Отправлено в облако", "ok");
  };

  const doPull = async () => {
    setBusy("pull"); setErr(null);
    const r = await cloudPull();
    setBusy(null);
    if (!r.ok) { setErr(r.error); return; }
    const snap = r.data ?? null;
    if (!snap) { toast("В облаке пока пусто — сначала отправьте данные", "warn"); return; }
    if (JSON.stringify(snap.data) === JSON.stringify(db)) { toast("Всё актуально", "ok"); return; }
    setPullAsk(snap);
  };

  const status = !cfg
    ? { cls: "bg-raise text-mute", dot: "bg-mute", label: "не подключено" }
    : cloudUser
      ? { cls: "bg-ok/15 text-ok", dot: "bg-ok", label: `в сети · ${cloudUser.email}` }
      : { cls: "bg-warn/15 text-warn", dot: "bg-warn", label: "подключено · нет входа" };

  const fmt = (t: number) =>
    new Date(t).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <Reveal>
      <section className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(520px 260px at 100% 0%, var(--glow2), transparent 70%)" }} />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-[16px] font-bold">
            <Icon name="cloud" size={18} className="text-accent" />Облако и синхронизация
          </h3>
          <span className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-bold", status.cls)}>
            <span className={cx("h-1.5 w-1.5 rounded-full", status.dot, cfg && "animate-[pulse-dot_2s_ease-in-out_infinite]")} />
            {status.label}
          </span>
        </div>
        <p className="relative mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-mute">
          Локальный режим работает всегда. Подключите свой проект Supabase — и лапки, журнал и дуэль
          будут жить на всех устройствах, а второй хозяин войдёт с телефона через Google или почту.
        </p>

        <div className="relative mt-5 grid gap-5 lg:grid-cols-2">
          {/* левая колонка: подключение / аккаунт / синк */}
          <div className="space-y-4">
            {!cfg ? (
              <div className="rounded-xl border border-line bg-bg2/50 p-4">
                <Field label="Project URL" hint="Supabase → Settings → API">
                  <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" spellCheck={false} />
                </Field>
                <div className="mt-3">
                  <Field label="Anon key" hint="публичный ключ, не секретный service_role">
                    <input className={inputCls} value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" spellCheck={false} />
                  </Field>
                </div>
                <Btn className="mt-4 w-full" onClick={connect} disabled={busy === "connect" || !url.trim() || !key.trim()}>
                  <Icon name={busy === "connect" ? "clock" : "cloud"} size={16} />
                  {busy === "connect" ? "Проверяем…" : "Проверить и подключить"}
                </Btn>
              </div>
            ) : (
              <>
                {!cloudUser ? (
                  <div className="rounded-xl border border-line bg-bg2/50 p-4">
                    <div className="mb-3 flex rounded-lg bg-raise p-1">
                      {([["in", "Вход"], ["up", "Регистрация"]] as const).map(([m, l]) => (
                        <button key={m} onClick={() => { setMode(m); setErr(null); }}
                          className={cx("flex-1 rounded-md py-1.5 text-[12.5px] font-bold transition-all", mode === m ? "bg-surface shadow" : "text-mute hover:text-ink")}>
                          {l}
                        </button>
                      ))}
                    </div>
                    <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.ru" type="email" />
                    <input className={cx(inputCls, "mt-2")} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Пароль" type="password" />
                    <Btn className="mt-3 w-full" onClick={auth} disabled={busy === "auth"}>
                      {busy === "auth" ? "Секунду…" : mode === "in" ? "Войти в облако" : "Создать аккаунт"}
                    </Btn>
                    <button onClick={google} disabled={busy === "google"}
                      className="mt-2.5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface py-2.5 text-[13.5px] font-bold transition-all hover:-translate-y-0.5 hover:border-mute disabled:opacity-60">
                      <GoogleG />Продолжить с Google
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-line bg-bg2/50 p-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ok/15 text-ok">
                        <Icon name="check" size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-bold">{cloudUser.email}</p>
                        <p className="text-[11.5px] font-semibold text-mute">
                          вход через {cloudUser.provider === "google" ? "Google" : "e-mail"}
                        </p>
                      </div>
                      <Btn variant="ghost" size="sm" onClick={async () => { await cloudSignOut(); setCloudUser(null); toast("Вышли из облака", "warn"); }}>
                        Выйти
                      </Btn>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-line bg-bg2/50 p-4">
                  <p className="text-[12px] font-bold uppercase tracking-wider text-mute">Синхронизация</p>
                  <p className="mt-1 text-[12.5px] text-mute">
                    {lastSync ? `Последний обмен: ${fmt(lastSync)}` : "Ещё не синхронизировали"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn size="sm" onClick={doPush} disabled={busy === "push" || !cloudUser}>
                      <Icon name={busy === "push" ? "clock" : "upload"} size={15} />
                      {busy === "push" ? "Отправляем…" : "Отправить в облако"}
                    </Btn>
                    <Btn size="sm" variant="soft" onClick={doPull} disabled={busy === "pull" || !cloudUser}>
                      <Icon name={busy === "pull" ? "clock" : "download"} size={15} />
                      {busy === "pull" ? "Получаем…" : "Загрузить из облака"}
                    </Btn>
                  </div>
                  <p className="mt-2.5 text-[11.5px] leading-relaxed text-mute">
                    «Загрузить» предложит заменить локальные данные снапшотом — ничего не теряется без подтверждения.
                  </p>
                </div>

                <Btn variant="ghost" size="sm" onClick={disconnect}>
                  <Icon name="x" size={14} />Отключить облако
                </Btn>
              </>
            )}

            {err && <p className="anim-fade rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] font-medium text-danger">{err}</p>}
          </div>

          {/* правая колонка: инструкция */}
          <div className="rounded-xl border border-dashed border-line p-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-mute">Настройка за 4 шага</p>
            <ol className="mt-3 space-y-3">
              {[
                ["Создайте проект на supabase.com (бесплатный план подходит)", null],
                ["SQL Editor → вставьте supabase/migrations/001_init.sql → Run", "таблицы, RLS, анти-чит лимиты и claim_invite()"],
                ["Settings → API: скопируйте Project URL и anon key сюда", null],
                ["Authentication → Providers: включите Email и Google для входа через Google", "нужны Client ID/Secret из Google Cloud Console"],
              ].map(([s, sub], i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-[12px] font-bold text-accent">{i + 1}</span>
                  <span className="text-[12.5px] leading-relaxed text-mute">
                    {s}{sub && <span className="block text-[11.5px] text-mute/75">{sub}</span>}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-mute">
              Без настройки приложение остаётся полностью рабочим: данные живут на этом устройстве,
              второй хозяин — через соседнюю вкладку.
            </p>
          </div>
        </div>
      </section>

      {/* подтверждение замены данных */}
      <Modal open={!!pullAsk} onClose={() => setPullAsk(null)}>
        <div className="p-6">
          <h3 className="font-display text-[18px] font-extrabold">Заменить локальные данные?</h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-mute">
            В облаке снапшот от <b className="text-ink">{pullAsk ? fmt(pullAsk.updatedAt) : ""}</b>.
            Текущий журнал на этом устройстве будет заменён облачным.
            Перед этим можно нажать «Отправить в облако», чтобы сохранить локальную версию.
          </p>
          <div className="mt-5 flex justify-end gap-2.5">
            <Btn variant="ghost" onClick={() => setPullAsk(null)}>Отмена</Btn>
            <Btn variant="danger" onClick={() => { if (pullAsk) { replaceDb(pullAsk.data); setLastSync(pullAsk.updatedAt); } setPullAsk(null); }}>
              <Icon name="download" size={15} />Заменить
            </Btn>
          </div>
        </div>
      </Modal>
    </Reveal>
  );
}
