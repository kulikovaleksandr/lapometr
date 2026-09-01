import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { Chip, EmptyState, Reveal, Seg, UserAvatar, cx, inputCls } from "../components/ui";
import { Icon } from "../components/icons";
import { DAY, dayLabel, fmtNum, fmtTime, pawsOf, plural, startOfDay } from "../lib/db";

type Period = "all" | "7" | "30";

export function JournalScreen() {
  const { acts, logs, owners, now, pet } = useApp();
  const [ownerF, setOwnerF] = useState<string>("all");
  const [actF, setActF] = useState<string>("all");
  const [period, setPeriod] = useState<Period>("30");

  const from = period === "all" ? 0 : startOfDay(now) - (Number(period) - 1) * DAY;

  const filtered = useMemo(
    () => logs
      .filter((l) => l.at >= from && (ownerF === "all" || l.ownerId === ownerF) && (actF === "all" || l.actId === actF))
      .sort((a, b) => b.at - a.at),
    [logs, from, ownerF, actF],
  );

  const groups = useMemo(() => {
    const m = new Map<number, typeof filtered>();
    for (const l of filtered) {
      const k = startOfDay(l.at);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  return (
    <div className="space-y-5">
      <header className="anim-fadeup">
        <p className="font-display text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
          журнал заботы
        </p>
        <h1 className="mt-1 font-display text-[26px] font-extrabold tracking-tight sm:text-[30px]">
          Хроники {pet?.name ?? "питомца"}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-mute">
          {filtered.length > 0
            ? `${fmtNum(filtered.length)} ${plural(filtered.length, "запись", "записи", "записей")} заботы — каждая на своём месте`
            : "Здесь появятся выполненные активности"}
        </p>
      </header>

      {/* фильтры */}
      <Reveal>
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={ownerF === "all"} onClick={() => setOwnerF("all")}>Все хозяева</Chip>
            {owners.map((o) => (
              <Chip key={o.id} active={ownerF === o.id} color={o.color} onClick={() => setOwnerF(o.id)}>
                <UserAvatar user={o} size={18} />{o.name}
              </Chip>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <select className={cx(inputCls, "w-auto py-1.5 text-[13px]")} value={actF} onChange={(e) => setActF(e.target.value)}>
              <option value="all">Все активности</option>
              {acts.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
            <Seg<Period>
              options={[{ id: "7", label: "7 дней" }, { id: "30", label: "30 дней" }, { id: "all", label: "Всё" }]}
              value={period} onChange={setPeriod}
            />
          </div>
        </div>
      </Reveal>

      {filtered.length === 0 ? (
        <EmptyState
          icon="book"
          title="Пока нет записей"
          text="Отметьте активность на главном экране — и здесь появится первый кружок на шкале времени."
        />
      ) : (
        <div className="space-y-7">
          {groups.map(([day, items]) => (
            <section key={day}>
              <Reveal>
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="font-display text-[15px] font-bold">{dayLabel(day, now)}</h2>
                  <span className="h-px flex-1 bg-line" />
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-raise px-2.5 py-1 font-display text-[11.5px] font-bold text-accent">
                    <Icon name="paw" size={12} />
                    {fmtNum(pawsOf(acts, items))} за день
                  </span>
                </div>
              </Reveal>

              <ol>
                {items.map((l, i) => {
                  const a = acts.find((x) => x.id === l.actId);
                  const o = owners.find((x) => x.id === l.ownerId);
                  const last = i === items.length - 1;
                  return (
                    <li key={l.id} className="anim-fadeup grid grid-cols-[46px_1fr]" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                      {/* рельса: кружок + соединительная полоса */}
                      <div className="flex flex-col items-center">
                        <span
                          className="z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-transform hover:scale-110"
                          style={{
                            background: `color-mix(in oklab, ${a?.color ?? "#888"} 25%, var(--surface))`,
                            borderColor: `color-mix(in oklab, ${a?.color ?? "#888"} 55%, var(--line))`,
                            color: a?.color ?? "var(--muted)",
                          }}
                          title={a?.title}
                        >
                          <Icon name={a?.icon ?? "paw"} size={19} />
                        </span>
                        {!last && <span className="tl-line w-[3px] flex-1 rounded-full" />}
                      </div>
                      {/* содержимое */}
                      <div className={cx("group ml-3 rounded-xl transition-colors hover:bg-raise/60", !last && "pb-5")}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pt-2">
                          <span className="font-display text-[14px] font-bold">{a?.title ?? "Активность"}</span>
                          <span className="inline-flex items-center gap-1 font-display text-[12px] font-bold text-accent">
                            <Icon name="paw" size={12} />+{a?.paws ?? 0}
                          </span>
                          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-raise py-0.5 pl-0.5 pr-2.5 text-[12px] font-bold">
                            <UserAvatar user={o ?? { id: "?", email: "", name: "—", pass: "", color: "#888", createdAt: 0 }} size={20} />
                            {o?.name ?? "—"}
                          </span>
                        </div>
                        <p className="px-2 pt-0.5 text-[12px] font-medium text-mute">
                          {fmtTime(l.at)} · {new Date(l.at).toLocaleDateString("ru-RU", { weekday: "short" })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}


