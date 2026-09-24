/*
 * Фаза 5 — Хозяева и дуэль: интеграционные тесты.
 * 5.1  формат приглашения /^[A-Z0-9]{6}$/, перегенерация, вход по коду (lowercase),
 *      повторный вход → «уже хозяин», неверный код → «не найден», код в DOM (InviteHero);
 * 5.2  экран «Дуэль»: периоды, корона «лидер», «лапок», топ-активность, серии;
 * 5.3  «Гонка последних 7 дней» + вердикт-подколка;
 * 5.4  removeOwner: защита от пустого владельца + передача роли «Владелец».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, act, render, screen, fireEvent } from "@testing-library/react";
import { AppProvider, useApp } from "../state/AppContext";
import { DuelScreen } from "../screens/Duel";
import { genInvite } from "../lib/types";
import * as ui from "../components/ui";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(AppProvider, null, children);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // jsdom не знает про IntersectionObserver — подменяем заглушкой (нужен для Reveal)
  (globalThis as Record<string, unknown>).IntersectionObserver = class {
    constructor(_cb: unknown, _opts?: unknown) {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Гость №1 создаёт питомца — возвращаем хук-результат с активным питомцем. */
function seeded() {
  vi.spyOn(ui, "toast").mockImplementation(() => undefined);
  const { result } = renderHook(() => useApp(), { wrapper });
  act(() => result.current.guest());
  act(() => result.current.createPet({ name: "Барсик", species: "cat", breed: "", birthday: "", color: "#ccc" }));
  return result;
}

/** Новый AppProvider: при mount читает общую localStorage-БД и слушает «lapometr:db». */
const NextProvider = ({ children }: { children: ReactNode }) =>
  createElement(AppProvider, null, children);

/** Рендер DuelScreen внутри собственного AppProvider (данные — из localStorage). */
const DuelInProvider = () =>
  createElement(NextProvider, null, createElement(DuelScreen, { onCopy: () => undefined }));

/** Перечитать localStorage-БД во все активные провайдеры (эмуляция другой вкладки). */
const syncAll = async () => { await act(async () => { fireEvent(window, new CustomEvent("lapometr:db")); }); };

describe("Фаза 5", () => {
  /* ---------------- 5.1 Пригласительный код ---------------- */

  it("5.1: genInvite() возвращает 6 символов A-Z0-9", () => {
    for (let i = 0; i < 50; i++) expect(genInvite()).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("5.1: питомец создаётся с валидным кодом; regenInvite() меняет код на валидный", () => {
    const r = seeded();
    const first = r.current.pet!.invite;
    expect(first).toMatch(/^[A-Z0-9]{6}$/);
    act(() => r.current.regenInvite());
    const second = r.current.pet!.invite;
    expect(second).toMatch(/^[A-Z0-9]{6}$/);
    // вероятность совпадения 6 символов ничтожна — считаем смену обязательной
    expect(second).not.toBe(first);
  });

  it("5.1: вход по коду в нижнем регистре добавляет вторым хозяином (helper)", async () => {
    const rA = seeded();
    const code = rA.current.pet!.invite;
    const idA = rA.current.user!.id;

    const { result: rB } = renderHook(() => useApp(), { wrapper: NextProvider });
    act(() => rB.current.guest()); // второй пользователь
    let err: string | null = "init";
    await act(async () => { err = await rB.current.joinPet(code.toLowerCase()); });
    expect(err).toBeNull();
    expect(rB.current.pet!.ownerIds).toHaveLength(2);
    expect(rB.current.pet!.ownerIds).toContain(idA);
    expect(rB.current.getUserRole(rB.current.user!.id)).toBe("helper");
    expect(rB.current.getUserRole(idA)).toBe("owner");
  });

  it("5.1: повторный вход тем же пользователем → «уже хозяин»", async () => {
    const r = seeded();
    const code = r.current.pet!.invite;
    let err: string | null = "init";
    await act(async () => { err = await r.current.joinPet(code); });
    expect(err).toBe("Вы уже хозяин этого питомца");
    expect(r.current.pet!.ownerIds).toHaveLength(1);
  });

  it("5.1: неверный код → «не найден»; пустой код → просьба ввести", async () => {
    const r = seeded();
    let err: string | null = "init";
    await act(async () => { err = await r.current.joinPet("ZZZ9ZZ"); });
    expect(err).toBe("Питомец с таким кодом не найден");
    await act(async () => { err = await r.current.joinPet("   "); });
    expect(err).toBe("Введите код приглашения");
  });

  it("5.1: InviteHero на экране «Дуэль» показывает код и кнопки Копировать/Новый", () => {
    const r = seeded();
    const code = r.current.pet!.invite;
    render(createElement(DuelInProvider));
    expect(screen.getByText("код приглашения")).toBeInTheDocument(); // заголовок блока
    expect(screen.getByText(code)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Копировать/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Новый/i })).toBeInTheDocument();
  });

  /* ---------------- 5.2 / 5.3 Экран «Дуэль»: табло, гонка, вердикт ---------------- */

  it("5.2/5.3: два хозяина с лапками — корона «лидер», «лапок», серии, гонка 7 дней и вердикт", async () => {
    const rA = seeded();
    const feed = rA.current.acts.find((a) => a.paws > 0)!;
    expect(feed).toBeTruthy();
    act(() => rA.current.complete(feed.id)); // лапки первому хозяину
    const nameA = rA.current.user!.name;
    await syncAll(); // провайдер B читает актуальный снимок БД из localStorage
    const code = rA.current.pet!.invite;

    // второй пользователь входит по коду (в отдельном провайдере — «другая вкладка»)
    const { result: rB } = renderHook(() => useApp(), { wrapper: NextProvider });
    act(() => rB.current.guest());
    await act(async () => { await rB.current.joinPet(code); });
    expect(rB.current.pet!.ownerIds).toHaveLength(2);
    await syncAll(); // провайдер A подтягивает обоих хозяев

    // экран Дуэли в новом провайдере: uid/pet берутся из sessionStorage (сессия B), БД — из localStorage
    const view = render(createElement(NextProvider, null, createElement(DuelScreen, { onCopy: () => undefined })));
    // 5.2: периоды, лапки, лидер, серии, топ-активность
    expect(screen.getByText("Сегодня")).toBeInTheDocument();
    expect(screen.getByText("Неделя")).toBeInTheDocument();
    expect(screen.getByText("Месяц")).toBeInTheDocument();
    expect(screen.getByText("Всё время")).toBeInTheDocument();
    expect(screen.getAllByText("лапок").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("лидер")).toBeInTheDocument();
    expect(screen.getAllByText(/день серии|дня серии|дней серии/).length).toBeGreaterThan(0);
    // «лапки» начисляются за каждое действие (paws — вес действия), не путать с числом действий
    expect(screen.getByText(/топ-забота ×\d+/)).toBeInTheDocument();
    // 5.3: гонка 7 дней + вердикт-подколка
    expect(screen.getByText("Гонка последних 7 дней")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${nameA} впереди`))).toBeInTheDocument();
  });

  /* ---------------- 5.4 Управление хозяевами ---------------- */

  it("5.4: нельзя убрать последнего хозяина; при удалении единственного owner роль переходит другому", async () => {
    const rA = seeded();
    const idA = rA.current.user!.id;
    await syncAll(); // провайдер B читает актуальный снимок БД из localStorage
    const code = rA.current.pet!.invite;

    // единственный хозяин — удаление заблокировано
    expect(rA.current.removeOwner(idA)).toMatch(/последнего хозяина/);
    expect(rA.current.pet!.ownerIds).toEqual([idA]);

    const { result: rB } = renderHook(() => useApp(), { wrapper: NextProvider });
    act(() => rB.current.guest());
    await act(async () => { await rB.current.joinPet(code); });
    const idB = rB.current.user!.id;
    expect(rB.current.pet!.ownerIds).toHaveLength(2);

    // удаление пользователя, который не является хозяином
    expect(rB.current.removeOwner("no-such-user")).toMatch(/не является хозяином/);

    // убираем A — единственного «Владельца»: право owner должно перейти к B
    expect(rB.current.removeOwner(idA)).toBeNull();
    await act(async () => {}); // даём эффекту saveDB отработаться
    const saved = JSON.parse(localStorage.getItem("lapometr.db.v1")!).pets[0];
    expect(saved.ownerIds).toEqual([idB]);
    expect(saved.ownerRoles[idB]).toBe("owner");
    await syncAll(); // перечитываем сохранённую БД во все провайдеры
    expect(rB.current.pet!.ownerIds).toEqual([idB]);
    expect(rB.current.getUserRole(idB)).toBe("owner");
    // и теперь питомца нельзя оставить без хозяина
    expect(rB.current.removeOwner(idB)).toMatch(/последнего хозяина/);
    expect(rB.current.pet!.ownerIds).toEqual([idB]);
  });
});
