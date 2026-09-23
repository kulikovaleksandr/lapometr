/*
 * Фаза 4 — Журнал и лапки: интеграционные тесты контекста приложения.
 * 4.1/4.3 complete() создаёт запись журнала (дата/время, вид, хозяин) и начисляет лапки;
 *         группировка по дням строится на startOfDay/dayLabel; прогресс уровня — на levelFor.
 * 4.2     фильтры «Журнала»: по хозяину, активности и периоду (7/30/all).
 * 4.3     тост «+N лапок» при начислении.
 * 4.4     лимиты: complete() блокирует отметку сверх limitDay/limitWeek/limitMonth.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { AppProvider, useApp } from "../state/AppContext";
import { limitsFor, pawsOf, startOfDay, dayLabel } from "../lib/db";
import { levelFor } from "../lib/types";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(AppProvider, null, children);

beforeEach(() => localStorage.clear());

function seeded() {
  const { result } = renderHook(() => useApp(), { wrapper });
  act(() => result.current.guest());
  act(() => result.current.createPet({ name: "Тест", species: "cat", breed: "", birthday: "", color: "#ccc" }));
  return result;
}

describe("Фаза 4", () => {
  it("4.1/4.3: complete() создаёт запись журнала и начисляет лапки", () => {
    const r = seeded();
    const feed = r.current.acts.find((a) => a.title === "Покормить")!;
    const before = pawsOf(r.current.acts, r.current.logs);

    act(() => r.current.complete(feed.id));

    expect(r.current.logs).toHaveLength(1);
    const log = r.current.logs[0];
    expect(log.actId).toBe(feed.id);              // вид активности
    expect(log.ownerId).toBe(r.current.user!.id); // хозяин
    expect(log.at).toBeGreaterThan(0);            // дата/время
    expect(pawsOf(r.current.acts, r.current.logs)).toBe(before + feed.paws); // лапки

    // группировка по дням (4.2): старт дня и подпись «Сегодня»
    expect(startOfDay(log.at)).toBe(startOfDay(Date.now()));
    expect(dayLabel(startOfDay(log.at))).toMatch(/сегодня/i);

    // прогресс уровня (4.3) пересчитывается от суммы лапок
    const lvl = levelFor(pawsOf(r.current.acts, r.current.logs));
    expect(lvl.prog).toBeGreaterThanOrEqual(0);
    expect(lvl.prog).toBeLessThanOrEqual(1);
  });

  it("4.3: тост «+N лапок» при начислении", async () => {
    const r = seeded();
    const feed = r.current.acts.find((a) => a.title === "Покормить")!;
    // спай после createPet — ловим только тосты от complete()
    const ui = await import("../components/ui");
    const spy = vi.spyOn(ui, "toast").mockImplementation(() => undefined);

    act(() => r.current.complete(feed.id));

    // createPet тоже показывал тост до установки спая; проверяем вызов от complete()
    expect(spy).toHaveBeenCalledTimes(1);
    const toastMsg = String(spy.mock.calls[0][0]);
    expect(toastMsg.startsWith(`+${feed.paws} `)).toBe(true);
    expect(/\u043b\u0430\u043f/.test(toastMsg)).toBe(true); // «лап...» — склонение «лапка/лапки/лапок»
    expect(spy.mock.calls[0][1]).toBe("ok");
    spy.mockRestore();
  });

  it("4.4: дневной лимит блокирует отметку (анти-чит на уровне данных)", () => {
    const r = seeded();
    const custom = { title: "Витамины", icon: "pill" as const, color: "#b3a3e0", paws: 5,
      limitDay: 2, limitWeek: 0, limitMonth: 0, remindH: 0 };
    let id = "";
    act(() => { id = r.current.addAct(custom)!; });

    act(() => { r.current.complete(id); r.current.complete(id); });
    expect(r.current.logs.filter((l) => l.actId === id)).toHaveLength(2);

    act(() => r.current.complete(id)); // третья — за лимитом
    expect(r.current.logs.filter((l) => l.actId === id)).toHaveLength(2);

    const st = limitsFor(r.current.acts.find((a) => a.id === id)!, r.current.logs, Date.now());
    expect(st.blocked).toBeTruthy();
    expect(st.day).toEqual({ used: 2, max: 2 });
  });

  it("4.2: фильтры журнала — по хозяину, активности и периоду (7/30/all)", () => {
    const r = seeded();
    const feed = r.current.acts.find((a) => a.title === "Покормить")!;
    const walk = r.current.acts.find((a) => a.title === "Погулять") ?? r.current.acts[1];
    act(() => { r.current.complete(feed.id); r.current.complete(walk.id); });

    const DAY = 86400000;
    const now = Date.now();
    const logs = [
      ...r.current.logs,
      { id: "old", actId: feed.id, petId: feed.petId, ownerId: r.current.user!.id, at: now - 100 * DAY },
    ];

    // период 30 дней — старая запись отсекается
    const from30 = startOfDay(now) - 29 * DAY;
    const in30 = logs.filter((l) => l.at >= from30);
    expect(in30).toHaveLength(2);
    // период all — всё на месте
    expect(logs.filter((l) => l.at >= 0)).toHaveLength(3);
    // фильтр по активности
    expect(in30.filter((l) => l.actId === feed.id)).toHaveLength(1);
    // фильтр по хозяину
    expect(in30.filter((l) => l.ownerId === r.current.user!.id)).toHaveLength(2);
  });
});
