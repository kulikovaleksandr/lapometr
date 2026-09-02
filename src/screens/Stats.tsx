import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { CountUp, Reveal, Seg, UserAvatar, cx } from "../components/ui";
import { Icon } from "../components/icons";
import {
  DAY, agoText, bestStreak, fmtNum, pawsOf, plural, startOfDay, streakDays,
} from "../lib/db";
import type { IconName } from "../lib/types";

type Period = "7" | "30" | "90";

export function StatsScreen() {
  const { acts, logs, owners, now } = useApp();
  const [period, setPeriod] = useState<Period>("30");
  const days = Number(period);
  const from = startOfDay(now) - (days - 1) * DAY;

  const logsP = useMemo(() => logs.filter((l) => l.at >= from), [logs, from]);

  /* сводные карточки */
  const totalPaws = pawsOf(acts, logsP);
  const perDay = useMemo(() => {
    const arr = Array.from({ length: days }, (_, i) => {
      const d = startOfDay(now) - (days - 1 - i) * DAY;
      const dayLogs = logsP.filter((l) => startOfDay(l.at) === d);
      return {
        d, dayLogs,
        vals: owners.map((o) => pawsOf(acts, dayLogs.filter((l) => l.ownerId === o.id))),
        count: dayLogs.length,
      };
    });
    return arr;
  }, [logsP, days, now, owners, acts]);
  const maxDay = Math.max(1, ...perDay.map((x) => x.vals.reduce((a, b) => a + b, 0)));
  const avg = logsP.length / days;
  const streak = streakDays(logs, now);
  const best = bestStreak(logs);
  const byAct = useMemo(() => {
    const m = new Map<string, number>();
    logsP.forEach((l) => m.set(l.actId, (m.get(l.actId) ?? 0) + 1));
    return [...m.entries()]
      .map(([id, n]) => ({ act: acts.find((a) => a.id === id), n, paws: (acts.find((a) => a.id === id)?.paws ?? 0) * n }))
      .filter((x) => x.act)
      .sort((a, b) => b.n - a.n);
  }, [logsP, acts]);
  const topAct = byAct[0];

  /* по часам */
  const byHour = useMemo(() => {
    const h = Array(24).fill(0) as number[];
    logsP.forEach((l) => { h[new Date(l.at).getHours()]++; });
    return h;
  }, [logsP]);
  const maxHour = Math.max(1, ...byHour);

  /* доли хозяев */
  const ownerRows = useMemo(() => owners.map((o) => {
    const own = logsP.filter((l) => l.ownerId === o.id);
    return { o, paws: pawsOf(acts, own), count: own.length };
  }), [owners, logsP, acts]);
  const totalOwnerPaws = Math.max(1, ownerRows.reduce((s, r) => s + r.paws, 0));
  const C = 2 * Math.PI * 38;
  let acc = 0;
  const donut = ownerRows.map((r) => {
    const frac = r.paws / totalOwnerPaws;
    const seg = { ...r, frac, offset: acc };
    acc += frac;
    return seg;
  });

  /* регулярность по активностям и хозяевам */
  const regularity = useMemo(() => byAct.map((x) => {
    const perOwner = owners.map((o) => logsP.filter((l) => l.actId === x.act!.id && l.ownerId === o.id).length);
    const lastAt = logsP.filter((l) => l.actId === x.act!.id).reduce((m, l) => Math.max(m, l.at), 0);
    return { ...x, perOwner, lastAt };
  }).slice(0, 10), [byAct, owners, logsP]);

  const cards: { icon: IconName; label: string; value: string; sub?: string }[] = [
    { icon: "check", label: "Активностей", value: fmtNum(logsP.length), sub: `за ${days} ${plural(days, "день", "дня", "дней")}` },
    { icon: "paw", label: "Лапок начислено", value: fmtNum(totalPaws) },
    { icon: "chart", label: "Среднее в день", value: avg.toFixed(1), sub: "активностей" },
    { icon: "flame", label: "Текущая серия", value: String(streak), sub: plural(streak, "день подряд", "дня подряд", "дней подряд") },
    { icon: "trophy", label: "Лучшая серия", value: String(best), sub: plural(best, "день", "дня", "дней") },
    { icon: "spark", label: "Топ-забота", value: topAct ? topAct.act!.title : "—", sub: topAct ? `×${topAct.n}` : undefined },
  ];

  return (
    <div className="space-y-5">
      <header className="anim-fadeup flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
            аналитика заботы
          </p>
          <h1 className="mt-1 font-display text-[26px] font-extrabold tracking-tight sm:text-[30px]">Статистика</h1>
        </div>
        <Seg<Period>
          options={[{ id: "7", label: "7 дней" }, { id: "30", label: "30 дней" }, { id: "90", label: "90 дней" }]}
          value={period} onChange={setPeriod}
        />
      </header>

      {/* сводка */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c, i) => (
          <Reveal key={c.label} delay={i * 50}>
            <div className="card card-i h-full p-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon name={c.icon} size={16} />
              </span>
              <p className="mt-2.5 truncate font-display text-[19px] font-extrabold tracking-tight" title={c.value}>{c.value}</p>
              <p className="text-[11.5px] font-semibold text-mute">{c.label}{c.sub ? <span className="text-mute/70"> · {c.sub}</span> : null}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* по дням */}
        <Reveal>
          <section className="card h-full p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-[16px] font-bold">Лапки по дням</h3>
              <div className="flex flex-wrap gap-3">
                {owners.map((o) => (
                  <span key={o.id} className="flex items-center gap-1.5 text-[12px] font-bold text-mute">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: o.color }} />{o.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex h-44 items-end gap-[3px]">
              {perDay.map((d) => {
                const total = d.vals.reduce((a, b) => a + b, 0);
                return (
                  <div
                    key={d.d}
                    className="group relative flex h-full min-w-0 flex-1 flex-col items-stretch justify-end"
                    title={`${new Date(d.d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}: ${total} лапок, ${d.count} ${plural(d.count, "активность", "активности", "активностей")}`}
                  >
                    {d.vals.map((v, i) => v > 0 && (
                      <span
                        key={i}
                        className={cx("w-full transition-all duration-500 group-hover:opacity-80", i === d.vals.length - 1 ? "rounded-t-[3px]" : "")}
                        style={{ height: `${(v / maxDay) * 100}%`, background: owners[i]?.color, minHeight: 3 }}
                      />
                    ))}
                    {total === 0 && <span className="w-full rounded-t-[3px]" style={{ height: 3, background: "var(--line)" }} />}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-semibold text-mute">
              <span>{new Date(perDay[0]?.d ?? now).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
              <span>сегодня</span>
            </div>
          </section>
        </Reveal>

        {/* донат долей */}
        <Reveal delay={90}>
          <section className="card flex h-full flex-col p-6">
            <h3 className="font-display text-[16px] font-bold">Кто сколько лапок принёс</h3>
            <div className="flex flex-1 items-center justify-center gap-7 py-4">
              <div className="relative">
                <svg width="150" height="150" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="var(--line)" strokeWidth="12" />
                  {donut.map((s) => s.frac > 0 && (
                    <circle
                      key={s.o.id} cx="50" cy="50" r="38" fill="none"
                      stroke={s.o.color} strokeWidth="12"
                      strokeDasharray={`${Math.max(0.5, s.frac * C - 1.5)} ${C}`}
                      strokeDashoffset={-s.offset * C}
                      transform="rotate(-90 50 50)"
                      style={{ transition: "stroke-dasharray .8s ease" }}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <p className="font-display text-[19px] font-extrabold"><CountUp value={totalPaws} /></p>
                    <p className="text-[10.5px] font-bold text-mute">лапок</p>
                  </div>
                </div>
              </div>
              <ul className="space-y-3">
                {donut.map((s) => (
                  <li key={s.o.id} className="flex items-center gap-2.5">
                    <UserAvatar user={s.o} size={26} />
                    <span className="text-[13px] font-bold">{s.o.name}</span>
                    <span className="font-display text-[12.5px] font-bold text-mute">{Math.round(s.frac * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </Reveal>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* по активностям */}
        <Reveal>
          <section className="card p-6">
            <h3 className="mb-4 font-display text-[16px] font-bold">Разрез по активностям</h3>
            {byAct.length === 0 ? (
              <p className="text-[13px] text-mute">Нет данных за период.</p>
            ) : (
              <ul className="space-y-3">
                {byAct.map((x) => {
                  const maxN = byAct[0].n;
                  return (
                    <li key={x.act!.id} className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${x.act!.color} 20%, transparent)`, color: x.act!.color }}>
                        <Icon name={x.act!.icon} size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[13.5px] font-bold">{x.act!.title}</span>
                          <span className="shrink-0 text-[12px] font-semibold text-mute">
                            ×{x.n} · <span className="text-accent">{fmtNum(x.paws)} лапок</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raise">
                          <div className="h-full rounded-full" style={{ width: `${(x.n / maxN) * 100}%`, background: x.act!.color, transition: "width .7s" }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </Reveal>

        {/* по часам */}
        <Reveal delay={90}>
          <section className="card h-full p-6">
            <h3 className="mb-4 font-display text-[16px] font-bold">В какое время заботятся</h3>
            <div className="flex h-32 items-end gap-[2px]">
              {byHour.map((v, h) => (
                <div key={h} className="group flex h-full flex-1 items-end" title={`${h}:00 — ${v} ${plural(v, "запись", "записи", "записей")}`}>
                  <span
                    className="w-full rounded-t-[2px] bg-accent transition-all duration-500 group-hover:brightness-125"
                    style={{ height: `${Math.max(v > 0 ? 8 : 3, (v / maxHour) * 100)}%`, opacity: v > 0 ? 0.55 + 0.45 * (v / maxHour) : 0.35 }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-semibold text-mute">
              <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
            </div>
            <p className="mt-3 text-[12px] text-mute">Пик заботы: {byHour.indexOf(Math.max(...byHour))}:00</p>
          </section>
        </Reveal>
      </div>

      {/* регулярность */}
      <Reveal>
        <section className="card p-6">
          <h3 className="mb-1 font-display text-[16px] font-bold">Регулярность по каждому хозяину</h3>
          <p className="mb-4 text-[12.5px] text-mute">Кто и как часто выполняет каждую заботу за выбранный период</p>
          {regularity.length === 0 ? (
            <p className="text-[13px] text-mute">Нет данных.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-line text-[11.5px] font-bold uppercase tracking-wider text-mute">
                    <th className="pb-2.5 pr-3 font-bold">Активность</th>
                    <th className="pb-2.5 pr-3 font-bold">Последний раз</th>
                    <th className="pb-2.5 pr-3 font-bold">Всего</th>
                    <th className="pb-2.5 font-bold">По хозяевам</th>
                  </tr>
                </thead>
                <tbody>
                  {regularity.map((x) => (
                    <tr key={x.act!.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-raise/50">
                      <td className="py-3 pr-3">
                        <span className="flex items-center gap-2.5 text-[13.5px] font-bold">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklab, ${x.act!.color} 20%, transparent)`, color: x.act!.color }}>
                            <Icon name={x.act!.icon} size={14} />
                          </span>
                          {x.act!.title}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-[12.5px] font-medium text-mute">{x.lastAt ? agoText(x.lastAt, now) : "—"}</td>
                      <td className="py-3 pr-3 font-display text-[13.5px] font-bold">×{x.n}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-2.5 w-full max-w-[220px] overflow-hidden rounded-full bg-raise">
                            {x.perOwner.map((n, i) => n > 0 && (
                              <span key={i} style={{ width: `${(n / x.n) * 100}%`, background: owners[i]?.color }} />
                            ))}
                          </div>
                          <span className="flex shrink-0 gap-2">
                            {x.perOwner.map((n, i) => (
                              <span key={i} className="flex items-center gap-1 text-[11.5px] font-bold text-mute">
                                <span className="h-2 w-2 rounded-full" style={{ background: owners[i]?.color }} />{n}
                              </span>
                            ))}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Reveal>
    </div>
  );
}
