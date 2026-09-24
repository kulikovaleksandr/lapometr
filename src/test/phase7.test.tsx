/*
 * Фаза 7 — Статистика: интеграционные тесты.
 * 7.1  периоды 7/30/90 дней (Seg), карточки-сводки: всего активностей, лапки,
 *      среднее/день, текущая и лучшая серии;
 * 7.2  график «Лапки по дням» — столбики с разбивкой по хозяевам (цвета owners);
 * 7.3  разрез по активностям (×счет · лапки) и по часам суток («В какое время заботятся»);
 * 7.4  донат «Кто сколько лапок принёс» (доли по хозяевам) + таблица регулярности
 *      по каждому хозяину.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, act, render, screen, fireEvent, within } from "@testing-library/react";
import { AppProvider, useApp } from "../state/AppContext";
import { StatsScreen } from "../screens/Stats";
import type { ActivityDef, IconName, LogEntry, Pet, SCHEMA_VERSION, User } from "../lib/types";
import * as ui from "../components/ui";

const DAY = 86400000;

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

interface SeedOpts {
  acts: { title: string; paws: number; icon?: IconName; color?: string }[];
  logs: { act: number; ownerId?: "me" | string; at: number }[];
  extraUsers?: { id: string; name: string; color: string }[];
}

/**
 * Готовит состояние ДО рендера экрана: один AppProvider на всё дерево
 * (гость + питомец через публичные действия), затем журнал и второй хозяин
 * через replaceDb. Никаких гонок двух экземпляров провайдера.
 */
let captured: ReturnType<typeof useApp> | null = null;
function Capture() {
  const ctx = useApp();
  captured = ctx;
  // всегда возвращаем актуальный контекст (после ре-рендеров от guest/createPet)
  result.current = ctx;
  return null;
}

const result: { current: any } = { current: null };

function seed(opts: SeedOpts) {
  vi.spyOn(ui, "toast").mockImplementation(() => undefined);
  render(createElement(Capture), { wrapper });
  act(() => result.current.guest());
  act(() => result.current.createPet({ name: "Барсик", species: "cat", breed: "", birthday: "", color: "#ccc" }));
  const meId = result.current.user!.id;
  const petId = result.current.pet!.id;

  // стандартные активности createPet заменяем заданными набором
  const acts: ActivityDef[] = opts.acts.map((a, i) => ({
    id: `a${i}`, petId, title: a.title, paws: a.paws,
    icon: a.icon ?? "feed", color: a.color ?? "#f00",
    limitDay: 0, limitWeek: 0, limitMonth: 0, remindH: 0, custom: true,
  }));
  const logs: LogEntry[] = opts.logs.map((l, i) => ({
    id: `l${i}`, actId: acts[l.act].id, petId,
    ownerId: !l.ownerId || l.ownerId === "me" ? meId : l.ownerId, at: l.at,
  }));
  const cur = result.current.db;
  act(() => result.current.replaceDb({
    ...cur,
    users: [...cur.users, ...(opts.extraUsers ?? [])],
    pets: cur.pets.map((p: Pet) => (p.id === petId ? { ...p, ownerIds: [...p.ownerIds, ...(opts.extraUsers ?? []).map((u) => u.id)] } : p)),
    acts: [...cur.acts.filter((a: ActivityDef) => a.petId !== petId), ...acts],
    logs,
  }));
  return result;
}

const renderStats = () => render(createElement(StatsScreen), { wrapper });

describe("Фаза 7 — Статистика", () => {
  /* ---------------- 7.1 Периоды и карточки-сводки ---------------- */

  it("7.1: переключатель периодов 7/30/90 дней", () => {
    const base = Date.now();
    seed({ acts: [{ title: "Покормить", paws: 5 }], logs: [0, 1, 2, 5].map((d) => ({ act: 0, at: base - d * DAY })) });
    renderStats();

    for (const label of ["7 дней", "30 дней", "90 дней"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // по умолчанию выбран 30-дневный период
    expect(screen.getByText(/за 30 дней/)).toBeInTheDocument();
    // переключаем период — экран остаётся рабочим, подпись карточки пересчитывается
    fireEvent.click(screen.getByText("7 дней"));
    expect(screen.getByText("Статистика")).toBeInTheDocument();
    expect(screen.getByText(/за 7 дней/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("90 дней"));
    expect(screen.getByText(/за 90 дней/)).toBeInTheDocument();
  });

  it("7.1: карточки-сводки — всего, лапки, среднее/день, серии", () => {
    const base = Date.now();
    seed({ acts: [{ title: "Покормить", paws: 5 }], logs: [0, 1, 2, 5].map((d) => ({ act: 0, at: base - d * DAY })) });
    renderStats();

    for (const label of ["Активностей", "Лапок начислено", "Среднее в день", "Текущая серия", "Лучшая серия"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // 4 записи за 30 дней → лапок 4×5=20, среднее 4/30≈0.1; серии: текущая 3, лучшая 3
    const card = (label: string) =>
      screen.getByText(label).closest(".card") as HTMLElement;
    expect(within(card("Активностей")).getByText("4")).toBeInTheDocument();
    expect(within(card("Лапок начислено")).getByText("20")).toBeInTheDocument();
    expect(within(card("Среднее в день")).getByText("0.1")).toBeInTheDocument();
    expect(within(card("Текущая серия")).getByText("3")).toBeInTheDocument();   // сегодня, -1, -2
    expect(within(card("Лучшая серия")).getByText("3")).toBeInTheDocument();
  });

  /* ---------------- 7.2 График по дням ---------------- */

  it("7.2: «Лапки по дням» — 30 столбиков, разбивка по хозяевам легендой", () => {
    const base = Date.now();
    seed({
      acts: [{ title: "Покормить", paws: 5 }],
      logs: [
        { act: 0, at: base }, { act: 0, at: base - 1000 },          // сегодня: 2×5=10 лапок
        { act: 0, at: base - DAY }, { act: 0, at: base - 2 * DAY }, // вчера и -2: по 5 лапок
      ],
    });
    const { container } = renderStats();
    expect(screen.getByText("Лапки по дням")).toBeInTheDocument();

    // легенда хозяев внутри секции графика
    const section = screen.getByText("Лапки по дням").closest("section") as HTMLElement;
    // гость называется «Гость 1» (makeGuest нумерует гостей) — ищем префиксом
    expect(within(section).getByText(/^Гость/)).toBeInTheDocument();

    // 30 дней периода → 30 столбцов графика (каждый с title-подсказкой «N лапок»)
    const bars = container.querySelectorAll('div.group[title*="лапок"]');
    expect(bars.length).toBe(30);
    // в дне с 2 записями × 5 лапок = 10 лапок
    expect([...bars].some((b) => /10 лапок/.test(b.getAttribute("title") || ""))).toBe(true);
  });

  /* ---------------- 7.3 Разрезы по активностям и часам ---------------- */

  it("7.3: разрез по активностям (×счет · лапки) и гистограмма по часам", () => {
    const base = Date.now();
    seed({
      acts: [{ title: "Покормить", paws: 5 }, { title: "Поиграть", paws: 3 }],
      logs: [
        { act: 0, at: base }, { act: 0, at: base - 3600e3 }, { act: 1, at: base - 7200e3 },
      ],
    });
    renderStats();

    // «Покормить» встречается и в разрезе по активностям (<li>), и в таблице регулярности (<td>).
    // Ищем именно строку разреза — closest("li") от нужного элемента.
    const feedRow = screen.getAllByText("Покормить").map((e) => e.closest("li")).find(Boolean) as HTMLElement;
    const playRow = screen.getAllByText("Поиграть").map((e) => e.closest("li")).find(Boolean) as HTMLElement;
    expect(within(feedRow).getByText(/×2/)).toBeInTheDocument();       // Покормить ×2
    expect(within(feedRow).getByText(/10 лапок/)).toBeInTheDocument(); // 2×5
    expect(within(playRow).getByText(/×1/)).toBeInTheDocument();       // Поиграть ×1
    expect(within(playRow).getByText(/3 лапок/)).toBeInTheDocument();  // 1×3

    expect(screen.getByText("В какое время заботятся")).toBeInTheDocument();
    expect(screen.getByText(/Пик заботы: \d+:00/)).toBeInTheDocument();
  });

  /* ---------------- 7.4 Донат долей + таблица регулярности ---------------- */

  it("7.4: доли лапок по хозяевам и таблица регулярности", () => {
    const base = Date.now();
    seed({
      acts: [{ title: "Покормить", paws: 5 }],
      extraUsers: [{ id: "u2", name: "Алина", color: "#0a0" }],
      logs: [
        { act: 0, ownerId: "me", at: base },
        { act: 0, ownerId: "me", at: base - 1000 },
        { act: 0, ownerId: "u2", at: base - 2000 },
      ],
    });
    renderStats();

    // донат: «Кто сколько лапок принёс», доли 10/15 и 5/15
    const donutSection = screen.getByText("Кто сколько лапок принёс").closest("section") as HTMLElement;
    expect(within(donutSection).getByText("67%")).toBeInTheDocument();
    expect(within(donutSection).getByText("33%")).toBeInTheDocument();
    expect(within(donutSection).getByText("Алина")).toBeInTheDocument();

    // таблица регулярности по каждому хозяину
    const tableSection = within(screen.getByText("Регулярность по каждому хозяину").closest("section") as HTMLElement);
    tableSection.getByText("Активность");
    tableSection.getByText("Последний раз");
    tableSection.getByText("Всего");
    tableSection.getByText("По хозяевам");
    const row = tableSection.getAllByText("Покормить")[0].closest("tr") as HTMLElement;
    expect(within(row).getByText("×3")).toBeInTheDocument(); // всего по «Покормить»
    // разбивка по хозяевам: 2 у гостя, 1 у Алины
    expect(within(row).getAllByText("2").length).toBeGreaterThan(0);
    expect(within(row).getAllByText("1").length).toBeGreaterThan(0);
  });
});
