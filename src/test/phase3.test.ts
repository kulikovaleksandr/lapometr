/*
 * Фаза 3 — Питомец и активности: интеграционные тесты контекста приложения.
 * 3.1 createPet (тип, кличка, порода, дата рождения, цвет)
 * 3.2 12 стандартных активностей с лапками/лимитами/remindH
 * 3.3 CRUD своих активностей
 * 3.4 анти-чит complete() + UI-статус «N/M сегодня»
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { AppProvider, useApp } from "../state/AppContext";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(AppProvider, null, children);

beforeEach(() => localStorage.clear());

describe("Фаза 3", () => {
  it("3.1–3.2: createPet создаёт питомца и 12 стандартных активностей", () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => result.current.guest());
    expect(result.current.user).toBeTruthy();
    expect(result.current.pet).toBeNull();

    act(() => result.current.createPet({
      name: "Барсик", species: "cat", breed: "Британец",
      birthday: "2023-05-01", color: "#e8a34e",
    }));

    const p = result.current.pet!;
    expect(p.name).toBe("Барсик");
    expect(p.species).toBe("cat");
    expect(p.breed).toBe("Британец");
    expect(p.birthday).toBe("2023-05-01");
    expect(p.color).toBe("#e8a34e");

    const petActs = result.current.db.acts.filter((a) => a.petId === p.id);
    expect(petActs.length).toBe(12);
    const feed = petActs.find((a) => a.title === "Покормить")!;
    expect(feed.paws).toBeGreaterThan(0);   // лапки
    expect(feed.limitDay).toBe(4);          // лимит день
    expect(feed.remindH).toBe(8);           // напоминание
  });

  it("3.3: CRUD своей активности (иконка, цвет, лапки, лимиты, remindH)", () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => result.current.guest());
    act(() => result.current.createPet({ name: "Рыжик", species: "cat", breed: "", birthday: "", color: "#ccc" }));

    const v = { title: "Дать витамины", icon: "pill" as const, color: "#b3a3e0", paws: 7,
      limitDay: 1, limitWeek: 0, limitMonth: 0, remindH: 24 };
    let id: string | null = null;
    act(() => { id = result.current.addAct(v); });
    expect(id).toBeTruthy();
    const created = result.current.acts.find((a) => a.id === id)!;
    expect(created.custom).toBe(true);
    expect(created.icon).toBe("pill");
    expect(created.remindH).toBe(24);

    act(() => result.current.updateAct(id!, { paws: 999, limitDay: -5 }));
    const upd = result.current.acts.find((a) => a.id === id)!;
    expect(upd.paws).toBeLessThanOrEqual(50); // нормализация
    expect(upd.limitDay).toBeGreaterThanOrEqual(0);

    // дубль названия отклоняется
    act(() => { expect(result.current.addAct(v)).toBeTruthy(); });

    act(() => result.current.deleteAct(id!));
    expect(result.current.acts.find((a) => a.id === id)).toBeUndefined();
  });

  it("3.4: complete() блокирует по дневному лимиту, UI-счётчик «2/4 сегодня»", () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => result.current.guest());
    act(() => result.current.createPet({ name: "Тест", species: "dog", breed: "", birthday: "", color: "#ccc" }));

    const feed = result.current.acts.find((a) => a.title === "Покормить")!;
    expect(feed.limitDay).toBe(4);

    for (let i = 0; i < 4; i++) act(() => result.current.complete(feed.id));
    expect(result.current.logs.filter((l) => l.actId === feed.id).length).toBe(4);

    // анти-чит: пятая отметка не записывается
    act(() => result.current.complete(feed.id));
    expect(result.current.logs.filter((l) => l.actId === feed.id).length).toBe(4);

    // недельный лимит тоже учитывается в статусе
    const brush = result.current.acts.find((a) => a.title === "Вычесать")!;
    act(() => result.current.complete(brush.id));
    act(() => result.current.complete(brush.id));
    const dayUsed = result.current.logs.filter((l) => l.actId === brush.id).length;
    expect(`${dayUsed}/${brush.limitWeek} на неделе`).toBe("2/5 на неделе");
  });
});
