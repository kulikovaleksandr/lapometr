import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { Bar, Btn, CountUp, Reveal, Seg, UserAvatar, cx } from "../components/ui";
import { Icon } from "../components/icons";
import {
  DAY, agoText, fmtNum, pawsOf, plural, startOfDay, startOfMonth, startOfWeek, streakDays,
} from "../lib/db";

type Period = "today" | "week" | "month" | "all";
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function DuelScreen({ onCopy }: { onCopy: (code: string) => void }) {
  const { acts, logs, owners, pet, user, now } = useApp();
  const [period, setPeriod] = useState<Period>("week");

  const from = period === "today" ? startOfDay(now)
    : period === "week" ? startOfWeek(now)
    : period === "month" ? startOfMonth(now)
    : 0;

  const rows = useMemo(() => owners.map((o) => {
    const own = logs.filter((l) => l.ownerId === o.id && l.at >= from);
    const cnt = new Map<string, number>();
    own.forEach((l) => cnt.set(l.actId, (cnt.get(l.actId) ?? 0) + 1));
    const topE = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0];
    const topActs = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const lastL = own.length ? own.reduce((m, l) => (l.at > m.at ? l : m)) : undefined;
    return {
      o,
      paws: pawsOf(acts, own),
      count: own.length,
      top: topE ? { title: acts.find((a) => a.id === topE[0])?.title ?? "?", n: topE[1] } : null,
      topActs: topActs.map(([id, n]) => ({ title: acts.find((a) => a.id === id)?.title ?? "?", n })),
      streak: streakDays(logs, now, o.id),
      last: lastL?.at,
    };
  }).sort((a, b) => b.paws - a.paws || b.count - a.count), [owners, logs, acts, from, now]);

  /* гонка последних 7 дней */
  const race = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => startOfDay(now - (6 - i) * DAY));
    return days.map((d, i) => ({
      d,
      wd: WD[(new Date(d).getDay() + 6) % 7],
      today: d === startOfDay(now),
      vals: owners.map((o) => pawsOf(acts, logs.filter((l) => l.ownerId === o.id && startOfDay(l.at) === d))),
      idx: i,
    }));
  }, [logs, acts, owners, now]);
  const raceMax = Math.max(1, ...race.flatMap((r) => r.vals));

  if (!pet || !user) return null;

  /* вердикт */
  let verdict = "";
  if (owners.length >= 2) {
    const [l1, l2] = rows;
    if (l1.paws === l2.paws && l1.count === l2.count) {
      verdict = `Идеальное равенство — ${pet.name} в восторге от обоих хозяев`;
    } else {
      verdict = `${l1.o.name} впереди: +${fmtNum(l1.paws - l2.paws)} ${plural(l1.paws - l2.paws, "лапка", "лапки", "лапок")} за период`;
      const l2best = l2.topActs[0];
      if (l2best && (!l1.topActs[0] || l2best.n > (l1.topActs.find((t) => t.title === l2best.title)?.n ?? 0))) {
        verdict += ` · ${l2.o.name} чаще «${l2best.title.toLowerCase()}»`;
      }
    }
  }

  return (
    <div className="space-y-5">
      <header className="anim-fadeup flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
            кто лучше заботится?
          </p>
          <h1 className="mt-1 font-display text-[26px] font-extrabold tracking-tight sm:text-[30px]">
            Дуэль хозяев
          </h1>
          {verdict && <p className="mt-1.5 max-w-xl text-[13.5px] font-medium text-mute">{verdict}</p>}
        </div>
        <Seg<Period>
          options={[
            { id: "today", label: "Сегодня" }, { id: "week", label: "Неделя" },
            { id: "month", label: "Месяц" }, { id: "all", label: "Всё время" },
          ]}
          value={period} onChange={setPeriod}
        />
      </header>

      {owners.length < 2 ? (
        <InviteHero onCopy={onCopy} />
      ) : (
        <>
          {/* табло */}
          <div className="grid gap-5 md:grid-cols-2">
            {rows.map((r, i) => {
              const leader = i === 0 && r.paws > 0;
              return (
                <Reveal key={r.o.id} delay={i * 90}>
                  <section className={cx("card card-i relative overflow-hidden p-6", leader && "border-accent/50")}>
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ background: `radial-gradient(360px 200px at 100% 0%, color-mix(in oklab, ${r.o.color} 12%, transparent), transparent 70%)` }}
                    />
                    {leader && (
                      <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-warn/18 px-3 py-1 font-display text-[11.5px] font-bold text-warn">
                        <Icon name="crown" size={14} />лидер
                      </span>
                    )}
                    <div className="relative flex items-center gap-4">
                      <UserAvatar user={r.o} size={56} ring />
                      <div className="min-w-0">
                        <p className="font-display text-[18px] font-extrabold tracking-tight">
                          {r.o.name}{r.o.id === user.id && <span className="ml-2 text-[12px] font-bold text-mute">· вы</span>}
                        </p>
                        <p className="text-[12.5px] text-mute">
                          {r.count > 0
                            ? `${r.count} ${plural(r.count, "активность", "активности", "активностей")}${r.last ? ` · посл. ${agoText(r.last, now)}` : ""}`
                            : "пока без записей за период"}
                        </p>
                      </div>
                    </div>

                    <div className="relative mt-5 flex items-end justify-between">
                      <span className="font-display text-[38px] font-extrabold leading-none tracking-tight" style={{ color: r.o.color }}>
                        <CountUp value={r.paws} />
                      </span>
                      <span className="inline-flex items-center gap-1.5 pb-1 font-display text-[13px] font-bold text-mute">
                        <Icon name="paw" size={15} />лапок
                      </span>
                    </div>
                    <Bar value={r.paws / Math.max(1, rows[0].paws)} color={r.o.color} h={10} className="mt-3" />

                    <div className="relative mt-5 grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl bg-raise px-3 py-2.5">
                        <p className="flex items-center gap-1.5 font-display text-[15px] font-bold">
                          <Icon name="flame" size={15} className="text-warn" />{r.streak}
                        </p>
                        <p className="text-[11px] font-semibold text-mute">{plural(r.streak, "день серии", "дня серии", "дней серии")}</p>
                      </div>
                      <div className="rounded-xl bg-raise px-3 py-2.5">
                        <p className="truncate font-display text-[15px] font-bold" title={r.top ? `${r.top.title} ×${r.top.n}` : "—"}>
                          {r.top ? r.top.title : "—"}
                        </p>
                        <p className="text-[11px] font-semibold text-mute">{r.top ? `топ-забота ×${r.top.n}` : "топ-забота"}</p>
                      </div>
                    </div>

                    {r.topActs.length > 0 && (
                      <ul className="relative mt-4 space-y-1.5 border-t border-line pt-4">
                        {r.topActs.map((t) => (
                          <li key={t.title} className="flex items-center gap-2 text-[12.5px]">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.o.color }} />
                            <span className="min-w-0 flex-1 truncate font-medium text-mute">{t.title}</span>
                            <span className="font-display font-bold">×{t.n}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </Reveal>
              );
            })}
          </div>

          {/* гонка недели */}
          <Reveal delay={120}>
            <section className="card p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-[16px] font-bold">Гонка последних 7 дней</h3>
                <div className="flex flex-wrap gap-3">
                  {owners.map((o) => (
                    <span key={o.id} className="flex items-center gap-1.5 text-[12.5px] font-bold text-mute">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: o.color }} />{o.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2 sm:gap-3">
                {race.map((d) => (
                  <div key={d.d} className="flex flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-end justify-center gap-1 sm:gap-1.5">
                      {d.vals.map((v, i) => (
                        <span
                          key={i}
                          title={`${owners[i]?.name}: ${v} лапок`}
                          className="w-3 rounded-t-md transition-all duration-500 hover:opacity-80 sm:w-4"
                          style={{
                            height: `${Math.max(v > 0 ? 6 : 2, (v / raceMax) * 100)}%`,
                            background: v > 0 ? owners[i]?.color : "var(--line)",
                            opacity: v > 0 ? 1 : 0.5,
                          }}
                        />
                      ))}
                    </div>
                    <span className={cx("text-[11.5px] font-bold", d.today ? "text-accent" : "text-mute")}>{d.wd}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-mute">Лапки по дням — кто не даёт шкале остывать</p>
            </section>
          </Reveal>
        </>
      )}
    </div>
  );
}

function InviteHero({ onCopy }: { onCopy: (code: string) => void }) {
  const { pet, regenInvite } = useApp();
  if (!pet) return null;
  return (
    <Reveal>
      <section className="card relative overflow-hidden p-7 sm:p-9">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(560px 300px at 85% 10%, var(--glow1), transparent 70%)" }}
        />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Icon name="trophy" size={26} />
            </span>
            <h2 className="mt-4 font-display text-[24px] font-extrabold leading-tight tracking-tight">
              Дуэль начинается со второго хозяина
            </h2>
            <ol className="mt-5 space-y-3.5">
              {[
                "Отправьте код приглашения тому, с кем делите заботу",
                "Пусть зарегистрируется в Лапометре и введёт код в настройках",
                "Общий журнал, общие лапки — и честное соревнование",
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-[14px] leading-relaxed">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-display text-[12px] font-bold text-accent-ink">
                    {i + 1}
                  </span>
                  <span className="text-mute">{s}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-dashed border-accent/50 bg-accent-soft/50 p-6 text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-mute">код приглашения</p>
            <p className="mt-2 font-display text-[30px] font-extrabold tracking-[0.08em] text-accent">{pet.invite}</p>
            <div className="mt-4 flex justify-center gap-2.5">
              <Btn onClick={() => onCopy(pet.invite)}><Icon name="copy" size={16} />Копировать</Btn>
              <Btn variant="soft" onClick={regenInvite} title="Создать новый код"><Icon name="spark" size={16} />Новый</Btn>
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-mute">
              В локальном режиме второй хозяин входит в этом же браузере
              (другая вкладка) — журнал синхронизируется мгновенно.
            </p>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
