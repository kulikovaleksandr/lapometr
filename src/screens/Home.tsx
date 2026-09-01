import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { Bar, Btn, Burst, CountUp, Modal, Reveal, Ring, UserAvatar, cx } from "../components/ui";
import { Icon, PetFace } from "../components/icons";
import {
  agoText, ageText, computeDue, durText, fmtTime, limitsFor, pawsOf, plural, streakDays,
} from "../lib/db";
import { speciesLabel } from "../lib/data";
import { ActivityDef, levelFor } from "../lib/types";
import type { Tab } from "../App";

export function HomeScreen({ onNav }: { onNav: (t: Tab) => void }) {
  const { user, pet, acts, logs, owners, now, complete } = useApp();
  const [sel, setSel] = useState<ActivityDef | null>(null);
  const [burst, setBurst] = useState(0);

  const total = useMemo(() => pawsOf(acts, logs), [acts, logs]);
  const lvl = levelFor(total);
  const due = useMemo(() => computeDue(acts, logs, now), [acts, logs, now]);
  const overdue = due.filter((d) => d.overdueMin === null || d.overdueMin > 0);
  const streak = useMemo(() => streakDays(logs, now), [logs, now]);
  const recent = useMemo(() => [...logs].sort((a, b) => b.at - a.at).slice(0, 4), [logs]);

  if (!pet || !user) return null;
  const hour = new Date(now).getHours();
  const hello = hour < 5 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  const mood = overdue.length === 0
    ? { icon: "heart" as const, text: `${pet.name} сыт и доволен`, cls: "text-ok" }
    : overdue.length <= 2
      ? { icon: "clock" as const, text: `${pet.name} ждёт внимания`, cls: "text-warn" }
      : { icon: "alert" as const, text: `${pet.name} совсем заждался`, cls: "text-danger" };

  const confirm = () => {
    if (!sel) return;
    complete(sel.id);
    setBurst((b) => b + 1);
    setTimeout(() => setSel(null), 700);
  };

  const selLimits = sel ? limitsFor(sel, logs, now) : null;

  return (
    <div className="space-y-5">
      {/* ---- Приветствие ---- */}
      <header className="anim-fadeup flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
            {new Date(now).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 font-display text-[26px] font-extrabold tracking-tight sm:text-[30px]">
            {hello}, {user.name.split(" ")[0]}
          </h1>
        </div>
        <button
          onClick={() => onNav("stats")}
          className="group flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-bold transition-all hover:border-accent"
        >
          <Icon name="flame" size={17} className="text-warn transition-transform group-hover:scale-110" />
          {streak > 0 ? (
            <span>Серия {streak} {plural(streak, "день", "дня", "дней")}</span>
          ) : (
            <span className="text-mute">Отметьте первую активность</span>
          )}
        </button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* ---- Карточка питомца ---- */}
        <Reveal>
          <section className="card card-i relative overflow-hidden p-6">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(420px 260px at 100% 0%, color-mix(in oklab, var(--accent) 9%, transparent), transparent 70%)" }}
            />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative mx-auto sm:mx-0">
                {pet.img ? (
                  <img src={pet.img} alt={pet.name} className="breathe h-32 w-32 rounded-[30%] object-cover shadow-lg" />
                ) : (
                  <span className="breathe block rounded-[30%] bg-raise p-2 shadow-inner">
                    <PetFace species={pet.species} color={pet.color} size={112} />
                  </span>
                )}
                <span className="absolute -bottom-1.5 -right-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-display text-[11px] font-bold text-accent-ink shadow">
                  <Icon name="paw" size={12} />
                  <CountUp value={total} />
                </span>
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h2 className="font-display text-[26px] font-extrabold tracking-tight">{pet.name}</h2>
                  <span className={cx("inline-flex items-center gap-1.5 rounded-full bg-raise px-2.5 py-1 text-[12px] font-bold", mood.cls)}>
                    <Icon name={mood.icon} size={13} />{mood.text}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-mute">
                  {speciesLabel(pet.species)}{pet.breed ? ` · ${pet.breed}` : ""}
                  {pet.birthday ? ` · ${ageText(pet.birthday, now)}` : ""}
                </p>

                <div className="mt-4 flex items-center justify-center gap-4 sm:justify-start">
                  <Ring value={lvl.prog} size={62} stroke={6}>
                    <span className="font-display text-[15px] font-bold">{lvl.idx + 1}</span>
                  </Ring>
                  <div>
                    <p className="font-display text-[14px] font-bold">«{lvl.title}»</p>
                    {lvl.next ? (
                      <p className="mt-0.5 text-[12px] text-mute">
                        {(lvl.next.at - total).toLocaleString("ru-RU")} лапок до «{lvl.next.t}»
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[12px] text-accent">Максимальный уровень заботы</p>
                    )}
                    <Bar value={lvl.prog} h={6} className="mt-2 max-w-[220px]" />
                  </div>
                </div>
              </div>
            </div>

            {/* хозяева */}
            <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <span className="text-[12px] font-semibold text-mute">Хозяева:</span>
              {owners.map((o) => (
                <span key={o.id} className="flex items-center gap-1.5 rounded-full bg-raise py-1 pl-1 pr-3 text-[12.5px] font-bold">
                  <UserAvatar user={o} size={22} />{o.name}{o.id === user.id && <span className="text-mute">· вы</span>}
                </span>
              ))}
              {owners.length < 2 && (
                <button onClick={() => onNav("duel")} className="flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-[12px] font-bold text-accent transition hover:border-accent">
                  <Icon name="plus" size={13} /> позвать второго
                </button>
              )}
            </div>
          </section>
        </Reveal>

        {/* ---- Пора позаботиться ---- */}
        <Reveal delay={80}>
          <section className="card flex h-full flex-col p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-[16px] font-bold">
                <Icon name="bell" size={18} className="text-accent" />Пора позаботиться
              </h3>
              {overdue.length > 0 && (
                <span className="rounded-full bg-danger/15 px-2.5 py-1 font-display text-[11.5px] font-bold text-danger">
                  {overdue.length}
                </span>
              )}
            </div>

            {due.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-mute">
                Напоминания настраиваются у каждой активности в настройках — включите интервал,
                и Лапометр подскажет, когда пора.
              </p>
            ) : (
              <ul className="space-y-2">
                {due.slice(0, 6).map((d) => {
                  const isOver = d.overdueMin === null || d.overdueMin > 0;
                  return (
                    <li key={d.act.id} className="group flex items-center gap-3 rounded-xl border border-line/70 bg-bg2/50 px-3 py-2.5 transition-all hover:border-line hover:bg-raise">
                      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in oklab, ${d.act.color} 22%, transparent)`, color: d.act.color }}>
                        <Icon name={d.act.icon} size={17} />
                        {isOver && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger" style={{ animation: "pulse-dot 1.6s ease-in-out infinite" }} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-bold">{d.act.title}</span>
                        <span className={cx("block text-[12px] font-medium", d.overdueMin === null ? "text-warn" : d.overdueMin > 0 ? "text-danger" : "text-mute")}>
                          {d.overdueMin === null
                            ? "ещё ни разу не выполнялось"
                            : d.overdueMin > 0
                              ? `просрочено на ${durText(d.overdueMin)}`
                              : `через ${durText(-d.overdueMin)}`}
                        </span>
                      </span>
                      <Btn size="sm" variant={isOver ? "primary" : "soft"} onClick={() => setSel(d.act)}>
                        Сделано
                      </Btn>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </Reveal>
      </div>

      {/* ---- Быстрые активности ---- */}
      <Reveal delay={120}>
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-[16px] font-bold">Отметить активность</h3>
            <span className="text-[12.5px] text-mute">каждая приносит лапки</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {acts.map((a, i) => {
              const st = limitsFor(a, logs, now);
              const isOver = due.find((d) => d.act.id === a.id && (d.overdueMin === null || d.overdueMin > 0));
              return (
                <button
                  key={a.id}
                  onClick={() => !st.blocked && setSel(a)}
                  disabled={!!st.blocked}
                  title={st.blocked ?? undefined}
                  className={cx(
                    "anim-fadeup group relative flex flex-col items-start gap-2.5 rounded-2xl border border-line bg-bg2/50 p-3.5 text-left transition-all",
                    st.blocked
                      ? "cursor-not-allowed opacity-45"
                      : "hover:-translate-y-0.5 hover:border-accent/60 hover:bg-raise active:scale-[0.98]",
                  )}
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  {isOver && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-danger" style={{ animation: "pulse-dot 1.6s infinite" }} />}
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110" style={{ background: `color-mix(in oklab, ${a.color} 22%, transparent)`, color: a.color }}>
                    <Icon name={a.icon} size={19} />
                  </span>
                  <span className="text-[13.5px] font-bold leading-tight">{a.title}</span>
                  <span className="mt-auto flex w-full items-center justify-between text-[11.5px] font-semibold">
                    <span className="inline-flex items-center gap-1 text-accent"><Icon name="paw" size={12} />+{a.paws}</span>
                    {st.day && (
                      <span className={cx("rounded-md px-1.5 py-0.5", st.day.used >= st.day.max ? "bg-danger/15 text-danger" : "bg-raise text-mute")}>
                        {st.day.used}/{st.day.max} сегодня
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---- Мини-дуэль ---- */}
        <Reveal>
          <section className="card card-i flex h-full flex-col p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-[16px] font-bold">
                <Icon name="trophy" size={18} className="text-accent" />Дуэль недели
              </h3>
              <Btn variant="ghost" size="sm" onClick={() => onNav("duel")}>вся дуэль <Icon name="chev" size={14} /></Btn>
            </div>
            {owners.length < 2 ? (
              <p className="text-[13px] leading-relaxed text-mute">
                Позовите второго хозяина по коду приглашения — и выясните, кто заботится лучше.
              </p>
            ) : (
              <MiniDuel />
            )}
          </section>
        </Reveal>

        {/* ---- Последние записи ---- */}
        <Reveal delay={80}>
          <section className="card card-i flex h-full flex-col p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-[16px] font-bold">
                <Icon name="book" size={18} className="text-accent" />Последние записи
              </h3>
              <Btn variant="ghost" size="sm" onClick={() => onNav("journal")}>весь журнал <Icon name="chev" size={14} /></Btn>
            </div>
            {recent.length === 0 ? (
              <p className="text-[13px] text-mute">Журнал пока пуст — отметьте первую активность выше.</p>
            ) : (
              <ul className="space-y-2.5">
                {recent.map((l) => {
                  const a = acts.find((x) => x.id === l.actId);
                  const o = owners.find((x) => x.id === l.ownerId);
                  return (
                    <li key={l.id} className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in oklab, ${a?.color ?? "#999"} 22%, transparent)`, color: a?.color ?? "var(--muted)" }}>
                        <Icon name={a?.icon ?? "paw"} size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-bold">{a?.title ?? "Активность"}</span>
                        <span className="block text-[12px] text-mute">{o?.name ?? "—"} · {fmtTime(l.at)} · {agoText(l.at, now)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 font-display text-[12px] font-bold text-accent">
                        <Icon name="paw" size={12} />+{a?.paws ?? 0}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </Reveal>
      </div>

      {/* ---- Модалка отметки ---- */}
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `«${sel.title}»` : ""}>
        {sel && selLimits && (
          <div>
            <div className="flex items-center gap-4">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `color-mix(in oklab, ${sel.color} 22%, transparent)`, color: sel.color }}>
                <Icon name={sel.icon} size={26} />
              </span>
              <div>
                <p className="font-display text-[15px] font-bold">{sel.title}</p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-accent">
                  <Icon name="paw" size={14} />+{sel.paws} лапок в журнал
                </p>
              </div>
            </div>

            {(selLimits.day || selLimits.week || selLimits.month) && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {selLimits.day && (
                  <div className="rounded-xl bg-raise px-2 py-2.5">
                    <p className="font-display text-[15px] font-bold">{selLimits.day.used}/{selLimits.day.max}</p>
                    <p className="text-[11px] font-semibold text-mute">сегодня</p>
                  </div>
                )}
                {selLimits.week && (
                  <div className="rounded-xl bg-raise px-2 py-2.5">
                    <p className="font-display text-[15px] font-bold">{selLimits.week.used}/{selLimits.week.max}</p>
                    <p className="text-[11px] font-semibold text-mute">за неделю</p>
                  </div>
                )}
                {selLimits.month && (
                  <div className="rounded-xl bg-raise px-2 py-2.5">
                    <p className="font-display text-[15px] font-bold">{selLimits.month.used}/{selLimits.month.max}</p>
                    <p className="text-[11px] font-semibold text-mute">за месяц</p>
                  </div>
                )}
              </div>
            )}

            {selLimits.blocked ? (
              <p className="anim-fade mt-4 flex items-start gap-2 rounded-xl bg-danger/12 px-3 py-2.5 text-[13px] font-medium text-danger">
                <Icon name="alert" size={16} className="mt-0.5 shrink-0" />{selLimits.blocked}
              </p>
            ) : (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-raise px-3 py-2.5 text-[12.5px] leading-relaxed text-mute">
                <Icon name="info" size={15} className="mt-0.5 shrink-0 text-accent" />
                Лимиты защищают от накрутки: одну активность нельзя выполнять бесконечно.
              </p>
            )}

            <div className="relative mt-5">
              <Btn size="lg" className="w-full" disabled={!!selLimits.blocked} onClick={confirm}>
                <Icon name="check" size={18} />Сделано, отметить
              </Btn>
              {burst > 0 && <span key={burst} className="absolute inset-0"><Burst seed={burst} /></span>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MiniDuel() {
  const { acts, logs, owners, now } = useApp();
  const weekStart = useMemo(() => {
    const wd = (new Date(now).getDay() + 6) % 7;
    const from = new Date(now).setHours(0, 0, 0, 0) as number;
    return from - wd * 86400000;
  }, [now]);
  const rows = owners.map((o) => {
    const own = logs.filter((l) => l.ownerId === o.id && l.at >= weekStart);
    return { o, paws: pawsOf(acts, own), count: own.length };
  }).sort((a, b) => b.paws - a.paws);
  const max = Math.max(1, ...rows.map((r) => r.paws));
  return (
    <div className="space-y-4">
      {rows.map((r, i) => (
        <div key={r.o.id}>
          <div className="mb-1.5 flex items-center justify-between text-[13px] font-bold">
            <span className="flex items-center gap-2">
              {i === 0 && <Icon name="crown" size={15} className="text-warn" />}
              <UserAvatar user={r.o} size={24} />{r.o.name}
            </span>
            <span className="inline-flex items-center gap-1 font-display text-accent"><Icon name="paw" size={13} />{r.paws.toLocaleString("ru-RU")}</span>
          </div>
          <Bar value={r.paws / max} color={r.o.color} h={10} />
        </div>
      ))}
      <p className="text-[12px] text-mute">Лапки с начала недели · активностей: {rows.map((r) => r.count).join(" против ")}</p>
    </div>
  );
}


