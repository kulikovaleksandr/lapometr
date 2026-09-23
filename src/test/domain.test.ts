import { describe, it, expect } from "vitest";
import { limitsFor, streakDays, computeDue, nextOccurrence } from "../lib/db";
import type { ActivityDef, LogEntry, VetEvent } from "../lib/types";

describe("Доменная логика", () => {
  describe("limitsFor", () => {
    it("должен разрешать активность без лимитов", () => {
      const act: ActivityDef = {
        id: "act1",
        petId: "pet1",
        title: "Покормить",
        icon: "feed",
        color: "#ff0000",
        paws: 5,
        limitDay: 0,
        limitWeek: 0,
        limitMonth: 0,
        remindH: 0,
      };
      const logs: LogEntry[] = [];
      const now = Date.now();

      const result = limitsFor(act, logs, now);

      expect(result.blocked).toBeUndefined();
      expect(result.day).toBe(0);
      expect(result.week).toBe(0);
      expect(result.month).toBe(0);
    });

    it("должен блокировать при превышении дневного лимита", () => {
      const act: ActivityDef = {
        id: "act1",
        petId: "pet1",
        title: "Покормить",
        icon: "feed",
        color: "#ff0000",
        paws: 5,
        limitDay: 3,
        limitWeek: 0,
        limitMonth: 0,
        remindH: 0,
      };
      const now = Date.now();
      const logs: LogEntry[] = [
        { id: "1", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 3600000 },
        { id: "2", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 7200000 },
        { id: "3", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 10800000 },
      ];

      const result = limitsFor(act, logs, now);

      expect(result.blocked).toBeDefined();
      expect(result.day).toBe(3);
    });

    it("должен разрешать при дневном лимите, если записей меньше", () => {
      const act: ActivityDef = {
        id: "act1",
        petId: "pet1",
        title: "Покормить",
        icon: "feed",
        color: "#ff0000",
        paws: 5,
        limitDay: 3,
        limitWeek: 0,
        limitMonth: 0,
        remindH: 0,
      };
      const now = Date.now();
      const logs: LogEntry[] = [
        { id: "1", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 3600000 },
        { id: "2", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 7200000 },
      ];

      const result = limitsFor(act, logs, now);

      expect(result.blocked).toBeUndefined();
      expect(result.day).toBe(2);
    });
  });

  describe("streakDays", () => {
    it("должен возвращать 0 при отсутствии записей", () => {
      const logs: LogEntry[] = [];
      const now = Date.now();

      const result = streakDays(logs, now);

      expect(result).toBe(0);
    });

    it("должен считать серию из нескольких дней", () => {
      const now = new Date("2024-01-15T12:00:00Z").getTime();
      const logs: LogEntry[] = [
        { id: "1", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 86400000 * 0 }, // сегодня
        { id: "2", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 86400000 * 1 }, // вчера
        { id: "3", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 86400000 * 2 }, // 2 дня назад
      ];

      const result = streakDays(logs, now);

      expect(result).toBe(3);
    });

    it("должен прерывать серию при пропуске дня", () => {
      const now = new Date("2024-01-15T12:00:00Z").getTime();
      const logs: LogEntry[] = [
        { id: "1", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 86400000 * 0 }, // сегодня
        { id: "2", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 86400000 * 1 }, // вчера
        // пропуск дня
        { id: "3", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 86400000 * 3 }, // 3 дня назад
      ];

      const result = streakDays(logs, now);

      expect(result).toBe(2);
    });
  });

  describe("computeDue", () => {
    it("должен возвращать пустой список при отсутствии активностей", () => {
      const acts: ActivityDef[] = [];
      const logs: LogEntry[] = [];
      const now = Date.now();

      const result = computeDue(acts, logs, now);

      expect(result).toEqual([]);
    });

    it("должен находить просроченные активности", () => {
      const now = Date.now();
      const acts: ActivityDef[] = [
        {
          id: "act1",
          petId: "pet1",
          title: "Покормить",
          icon: "feed",
          color: "#ff0000",
          paws: 5,
          limitDay: 0,
          limitWeek: 0,
          limitMonth: 0,
          remindH: 8, // напоминать каждые 8 часов
        },
      ];
      const logs: LogEntry[] = [
        { id: "1", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 9 * 3600000 }, // 9 часов назад
      ];

      const result = computeDue(acts, logs, now);

      expect(result.length).toBe(1);
      expect(result[0].act.id).toBe("act1");
      expect(result[0].overdueMin).toBeGreaterThan(0);
    });

    it("должен находить активности, которые скоро наступят", () => {
      const now = Date.now();
      const acts: ActivityDef[] = [
        {
          id: "act1",
          petId: "pet1",
          title: "Покормить",
          icon: "feed",
          color: "#ff0000",
          paws: 5,
          limitDay: 0,
          limitWeek: 0,
          limitMonth: 0,
          remindH: 8,
        },
      ];
      const logs: LogEntry[] = [
        { id: "1", petId: "pet1", actId: "act1", ownerId: "user1", at: now - 7 * 3600000 }, // 7 часов назад
      ];

      const result = computeDue(acts, logs, now);

      expect(result.length).toBe(1);
      expect(result[0].act.id).toBe("act1");
      expect(result[0].overdueMin).toBe(0);
    });
  });

  describe("nextOccurrence", () => {
    it("должен возвращать дату для события без повтора", () => {
      const event: VetEvent = {
        id: "ev1",
        petId: "pet1",
        kind: "shot",
        title: "Прививка",
        date: "2024-06-15",
        repeat: "none",
      };
      const now = new Date("2024-06-10T12:00:00Z").getTime();

      const result = nextOccurrence(event, now);

      expect(result).toBe(new Date("2024-06-15T00:00:00Z").getTime());
    });

    it("должен возвращать следующую дату для ежемесячного события", () => {
      const event: VetEvent = {
        id: "ev1",
        petId: "pet1",
        kind: "pill",
        title: "Обработка от блох",
        date: "2024-01-15",
        repeat: "monthly",
      };
      const now = new Date("2024-03-20T12:00:00Z").getTime();

      const result = nextOccurrence(event, now);

      expect(result).toBe(new Date("2024-04-15T00:00:00Z").getTime());
    });

    it("должен корректно обрабатывать 31-е число в месяце с 30 днями", () => {
      const event: VetEvent = {
        id: "ev1",
        petId: "pet1",
        kind: "pill",
        title: "Обработка",
        date: "2024-01-31", // 31 января
        repeat: "monthly",
      };
      const now = new Date("2024-02-15T12:00:00Z").getTime(); // февраль (28/29 дней)

      const result = nextOccurrence(event, now);

      // Должно вернуть 29 февраля (високосный год) или 28 февраля
      const resultDate = new Date(result);
      expect(resultDate.getFullYear()).toBe(2024);
      expect(resultDate.getMonth()).toBe(1); // февраль (0-indexed)
      expect(resultDate.getDate()).toBeGreaterThanOrEqual(28);
      expect(resultDate.getDate()).toBeLessThanOrEqual(29);
    });

    it("должен возвращать следующую дату для ежегодного события", () => {
      const event: VetEvent = {
        id: "ev1",
        petId: "pet1",
        kind: "shot",
        title: "Ежегодная прививка",
        date: "2023-06-15",
        repeat: "yearly",
      };
      const now = new Date("2024-03-20T12:00:00Z").getTime();

      const result = nextOccurrence(event, now);

      expect(result).toBe(new Date("2024-06-15T00:00:00Z").getTime());
    });

    it("должен возвращать прошлую дату, если событие ещё не наступило", () => {
      const event: VetEvent = {
        id: "ev1",
        petId: "pet1",
        kind: "shot",
        title: "Прививка",
        date: "2024-12-15",
        repeat: "none",
      };
      const now = new Date("2024-06-10T12:00:00Z").getTime();

      const result = nextOccurrence(event, now);

      expect(result).toBe(new Date("2024-12-15T00:00:00Z").getTime());
    });
  });
});
