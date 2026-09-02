import { useMemo, useState } from "react";
import { useApp, VetInput } from "../state/AppContext";
import { Btn, EmptyState, Field, Modal, Reveal, Seg, cx, inputCls } from "../components/ui";
import { Icon } from "../components/icons";
import {
  DAY, REPEAT_LABEL, VET_KINDS, dueLabel, nextOccurrence, startOfDay, vetKind,
} from "../lib/db";
import type { VetEvent, VetKind } from "../lib/types";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/** События, попадающие в конкретный месяц (для точек в календаре) */
function eventsOnMonth(events: VetEvent[], y: number, m: number): Map<number, VetEvent[]> {
  const map = new Map<number, VetEvent[]>();
  const dim = new Date(y, m + 1, 0).getDate();
  const push = (day: number, ev: VetEvent) => {
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(ev);
  };
  for (const ev of events) {
    const [ey, em, ed] = ev.date.split("-").map(Number);
    if (ev.repeat === "none") {
      if (ey === y && em - 1 === m) push(ed, ev);
    } else if (ev.repeat === "yearly") {
      if (em - 1 === m) push(Math.min(ed, dim), ev);
    } else {
      push(Math.min(ed, dim), ev);
    }
  }
  return map;
}

export function VetScreen() {
  const { events, now, pet } = useApp();
  const [view, setView] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selDay, setSelDay] = useState<number | null>(null);
  const [edit, setEdit] = useState<VetEvent | "new" | null>(null);

  const y = view.getFullYear(), m = view.getMonth();
  const today = new Date(now);
  const isCurMonth = today.getFullYear() === y && today.getMonth() === m;

  const byDay = useMemo(() => eventsOnMonth(events, y, m), [events, y, m]);

  /* список: выбранный день или ближайшие 60 дней */
  const list = useMemo(() => {
    if (selDay !== null) {
      const from = startOfDay(new Date(y, m, selDay).getTime());
      return events
        .map((ev) => ({ ev, occ: nextOccurrence(ev, now) }))
        .filter(({ occ }) => startOfDay(occ) === from)
        .sort((a, b) => a.occ - b.occ);
    }
    return events
      .map((ev) => ({ ev, occ: nextOccurrence(ev, now) }))
      .filter(({ occ }) => occ <= now + 60 * DAY)
      .sort((a, b) => a.occ - b.occ)
      .slice(0, 10);
  }, [events, now, selDay, y, m]);

  const dueSoon = useMemo(
    () => events.filter((ev) => startOfDay(nextOccurrence(ev, now)) <= now).length,
    [events, now],
  );

  if (!pet) return null;

  const cells: (number | null)[] = [];
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) cells.push(null);
  const dim = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selDateLabel = selDay !== null
    ? new Date(y, m, selDay).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    : null;

  return (
    <div className="space-y-5">
      <header className="anim-fadeup flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
            здоровье и прививки
          </p>
          <h1 className="mt-1 font-display text-[26px] font-extrabold tracking-tight sm:text-[30px]">
            Вет-календарь {pet.name}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-mute">
            {events.length === 0
              ? "Прививки, обработки и осмотры — чтобы ничего не забыть"
              : `${events.length} ${events.length === 1 ? "событие" : events.length < 5 ? "события" : "событий"} · ${dueSoon > 0 ? `${dueSoon} требуют внимания` : "всё по плану"}`}
          </p>
        </div>
        <Btn onClick={() => setEdit("new")}>
          <Icon name="plus" size={16} />Добавить событие
        </Btn>
      </header>

      {events.length === 0 ? (
        <EmptyState
          icon="stetho"
          title="Календарь пока пуст"
          text="Добавьте первую прививку, обработку от паразитов или визит к врачу — Лапометр напомнит в браузере и в Telegram."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          {/* ---- календарь месяца ---- */}
          <Reveal>
            <section className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-[16px] font-bold">
                  {MONTHS[m]} <span className="text-mute">{y}</span>
                </h3>
                <div className="flex items-center gap-1.5">
                  {selDateLabel && (
                    <button
                      onClick={() => setSelDay(null)}
                      className="anim-pop mr-1 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-bold text-accent transition hover:brightness-110"
                    >
                      {selDateLabel}<Icon name="x" size={12} />
                    </button>
                  )}
                  <button onClick={() => setView(new Date(y, m - 1, 1))} aria-label="Предыдущий месяц"
                    className="rounded-lg border border-line p-2 text-mute transition hover:border-accent hover:text-accent">
                    <Icon name="chev" size={15} className="rotate-180" />
                  </button>
                  <button onClick={() => { setView(new Date(today.getFullYear(), today.getMonth(), 1)); setSelDay(null); }}
                    className="rounded-lg border border-line px-3 py-2 text-[12.5px] font-bold text-mute transition hover:border-accent hover:text-accent">
                    Сегодня
                  </button>
                  <button onClick={() => setView(new Date(y, m + 1, 1))} aria-label="Следующий месяц"
                    className="rounded-lg border border-line p-2 text-mute transition hover:border-accent hover:text-accent">
                    <Icon name="chev" size={15} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {WD.map((w, i) => (
                  <span key={w} className={cx("pb-1 text-center text-[11px] font-bold uppercase tracking-wide", i >= 5 ? "text-rose/70" : "text-mute")}>
                    {w}
                  </span>
                ))}
                {cells.map((d, i) => {
                  if (d === null) return <span key={`x${i}`} />;
                  const evs = byDay.get(d) ?? [];
                  const isToday = isCurMonth && today.getDate() === d;
                  const isSel = selDay === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setSelDay(isSel ? null : d)}
                      className={cx(
                        "relative flex min-h-[52px] flex-col items-center rounded-xl border pt-1.5 transition-all",
                        isSel
                          ? "border-accent bg-accent-soft shadow-sm"
                          : "border-transparent hover:-translate-y-0.5 hover:border-line hover:bg-raise",
                        evs.length > 0 && !isSel && "bg-raise/50",
                      )}
                    >
                      <span className={cx(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full font-display text-[12.5px] font-bold",
                        isToday ? "bg-accent text-accent-ink" : evs.length > 0 ? "text-ink" : "text-mute",
                      )}>
                        {d}
                      </span>
                      {evs.length > 0 && (
                        <span className="mt-1 flex items-center gap-1">
                          {evs.slice(0, 3).map((ev) => (
                            <span key={ev.id} className="h-1.5 w-1.5 rounded-full" style={{ background: vetKind(ev.kind).color }} />
                          ))}
                          {evs.length > 3 && <span className="text-[9.5px] font-bold text-mute">+{evs.length - 3}</span>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* легенда */}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3.5">
                {VET_KINDS.map((k) => (
                  <span key={k.id} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-mute">
                    <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />{k.label}
                  </span>
                ))}
              </div>
            </section>
          </Reveal>

          {/* ---- ближайшее ---- */}
          <Reveal delay={90}>
            <section className="card flex h-full flex-col p-5">
              <h3 className="mb-3.5 font-display text-[16px] font-bold">
                {selDateLabel ? `События · ${selDateLabel}` : "Ближайшее"}
              </h3>
              {list.length === 0 ? (
                <p className="text-[13px] leading-relaxed text-mute">
                  {selDateLabel ? "В этот день событий нет." : "На горизонте 60 дней событий нет — можно выдохнуть."}
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {list.map(({ ev, occ }) => {
                    const k = vetKind(ev.kind);
                    const due = dueLabel(ev, now);
                    return (
                      <li
                        key={ev.id}
                        className="group flex items-start gap-3 rounded-xl border border-line/70 bg-bg2/50 p-3 transition-all hover:border-line hover:bg-raise"
                      >
                        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: `color-mix(in oklab, ${k.color} 22%, transparent)`, color: k.color }}>
                          <Icon name={k.icon} size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-[13.5px] font-bold">{ev.title}</span>
                            {ev.repeat !== "none" && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-raise px-1.5 py-0.5 text-[10.5px] font-bold text-mute">
                                <Icon name="repeat" size={11} />{REPEAT_LABEL[ev.repeat]}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-[12px] font-medium text-mute">
                            {new Date(occ).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                            {ev.time ? ` · ${ev.time}` : ""}
                          </span>
                          <span className={cx(
                            "mt-0.5 block text-[12px] font-bold",
                            due.tone === "danger" ? "text-danger" : due.tone === "warn" ? "text-warn" : "text-ok",
                          )}>
                            {due.text}
                          </span>
                          {ev.note && <span className="mt-1 block text-[11.5px] italic leading-relaxed text-mute/80">{ev.note}</span>}
                        </span>
                        <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => setEdit(ev)} aria-label="Изменить"
                            className="rounded-lg p-1.5 text-mute transition hover:bg-surface hover:text-ink">
                            <Icon name="edit" size={15} />
                          </button>
                          <DeleteBtn id={ev.id} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-auto pt-4 text-[12px] leading-relaxed text-mute">
                Напоминания о событиях дня приходят в браузерные уведомления
                {` `}и в Telegram — если он подключён в настройках.
              </p>
            </section>
          </Reveal>
        </div>
      )}

      <EventModal key={edit === "new" ? "new" : edit?.id ?? "none"} ev={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function DeleteBtn({ id }: { id: string }) {
  const { deleteEvent } = useApp();
  const [ask, setAsk] = useState(false);
  if (ask) {
    return (
      <Btn variant="danger" size="sm" onClick={() => deleteEvent(id)}>Точно?</Btn>
    );
  }
  return (
    <button
      onClick={() => { setAsk(true); setTimeout(() => setAsk(false), 2600); }}
      aria-label="Удалить"
      className="rounded-lg p-1.5 text-mute transition hover:bg-danger/12 hover:text-danger"
    >
      <Icon name="trash" size={15} />
    </button>
  );
}

function EventModal({ ev, onClose }: { ev: VetEvent | "new" | null; onClose: () => void }) {
  const { addEvent, updateEvent, pet } = useApp();
  const def = ev && ev !== "new" ? ev : null;
  const [title, setTitle] = useState(def?.title ?? "");
  const [kind, setKind] = useState<VetKind>(def?.kind ?? "shot");
  const [date, setDate] = useState(def?.date ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(def?.time ?? "");
  const [repeat, setRepeat] = useState<VetEvent["repeat"]>(def?.repeat ?? "none");
  const [note, setNote] = useState(def?.note ?? "");
  const [err, setErr] = useState<string | null>(null);

  if (!ev) return null;

  const save = () => {
    const input: VetInput = { title, kind, date, time: time || undefined, repeat, note };
    if (def) {
      updateEvent(def.id, { title: title.trim(), kind, date, time: time || undefined, repeat, note: note.trim() || undefined });
      onClose();
    } else {
      const r = addEvent(input);
      if (r) { setErr(r); return; }
      onClose();
    }
  };

  return (
    <Modal open onClose={onClose} title={def ? "Изменить событие" : `Новое событие для ${pet?.name ?? "питомца"}`}>
      <div className="space-y-4">
        <Field label="Что происходит?">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Прививка от бешенства" autoFocus />
        </Field>

        <div>
          <span className="mb-2 block text-[12.5px] font-semibold text-mute">Тип события</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {VET_KINDS.map((k) => (
              <button
                key={k.id} onClick={() => setKind(k.id)}
                className={cx(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all hover:-translate-y-0.5",
                  kind === k.id ? "border-accent bg-accent-soft" : "border-line hover:border-mute",
                )}
              >
                <span style={{ color: k.color }}><Icon name={k.icon} size={19} /></span>
                <span className={cx("text-[11px] font-bold", kind === k.id ? "text-ink" : "text-mute")}>{k.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Дата">
            <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Время (необязательно)">
            <input className={inputCls} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <div>
            <span className="mb-2 block text-[12.5px] font-semibold text-mute">Повтор</span>
            <Seg<VetEvent["repeat"]>
              options={[{ id: "none", label: "Раз" }, { id: "monthly", label: "Месяц" }, { id: "yearly", label: "Год" }]}
              value={repeat} onChange={setRepeat}
            />
          </div>
        </div>

        {repeat !== "none" && (
          <p className="anim-fade flex items-start gap-2 rounded-xl bg-raise px-3 py-2.5 text-[12.5px] leading-relaxed text-mute">
            <Icon name="repeat" size={15} className="mt-0.5 shrink-0 text-accent" />
            Событие будет возвращаться {repeat === "monthly" ? "каждый месяц в это же число" : "каждый год в эту дату"} — напоминание сработает в день наступления.
          </p>
        )}

        <Field label="Заметка (необязательно)">
          <textarea
            className={cx(inputCls, "min-h-[70px] resize-y")}
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Клиника, препарат, дозировка…"
          />
        </Field>

        {err && <p className="anim-fade text-[13px] font-medium text-danger">{err}</p>}

        <div className="flex justify-end gap-2.5 pt-1">
          <Btn variant="ghost" onClick={onClose}>Отмена</Btn>
          <Btn onClick={save}><Icon name="check" size={16} />{def ? "Сохранить" : "Добавить"}</Btn>
        </div>
      </div>
    </Modal>
  );
}
