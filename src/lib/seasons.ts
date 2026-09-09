import type { Pet, LogEntry, ActivityDef, SeasonSettings, MonthlyResult } from "./types";

/**
 * Получить настройки сезона для питомца
 */
export function getSeasonSettings(
  settings: Record<string, SeasonSettings>,
  petId: string
): SeasonSettings {
  return settings[petId] ?? { enabled: true, resetDay: 1 };
}

/**
 * Получить начало сезона для питомца
 * Краевой случай: если питомец создан в середине месяца, сезон начинается с даты создания
 */
export function getSeasonStart(
  pet: Pet,
  seasonSettings: SeasonSettings,
  now: number = Date.now()
): number {
  if (!seasonSettings.enabled) {
    return 0; // если сезоны выключены, считаем с самого начала
  }

  const nowDate = new Date(now);
  const currentDay = nowDate.getDate();
  const resetDay = seasonSettings.resetDay;

  // Определяем начало текущего сезона
  let seasonStart: Date;
  
  if (currentDay >= resetDay) {
    // Мы в текущем сезоне, который начался в этом месяце
    seasonStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), resetDay);
  } else {
    // Мы в сезоне, который начался в прошлом месяце
    seasonStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, resetDay);
  }

  // Краевой случай: если питомец создан после начала сезона,
  // сезон начинается с даты создания питомца
  const petCreatedAt = new Date(pet.createdAt);
  if (petCreatedAt > seasonStart) {
    return pet.createdAt;
  }

  return seasonStart.getTime();
}

/**
 * Получить конец сезона
 */
export function getSeasonEnd(
  pet: Pet,
  seasonSettings: SeasonSettings,
  now: number = Date.now()
): number {
  const start = getSeasonStart(pet, seasonSettings, now);
  const startDate = new Date(start);
  
  // Краевой случай: если сезон начался с даты создания питомца,
  // конец сезона - конец месяца создания
  if (start === pet.createdAt) {
    const endOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return endOfMonth.getTime();
  }

  // Обычный случай: конец сезона - конец текущего месяца
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
  return endDate.getTime();
}

/**
 * Получить логи за сезон
 */
export function getSeasonLogs(
  logs: LogEntry[],
  pet: Pet,
  seasonSettings: SeasonSettings,
  now: number = Date.now()
): LogEntry[] {
  const start = getSeasonStart(pet, seasonSettings, now);
  const end = getSeasonEnd(pet, seasonSettings, now);

  return logs.filter(log => 
    log.petId === pet.id &&
    log.at >= start &&
    log.at <= end
  );
}

/**
 * Подсчитать лапки по пользователям за сезон
 */
export function getSeasonPawsByUser(
  logs: LogEntry[],
  activities: ActivityDef[],
  pet: Pet,
  seasonSettings: SeasonSettings,
  now: number = Date.now()
): Record<string, number> {
  const seasonLogs = getSeasonLogs(logs, pet, seasonSettings, now);
  const pawsByUser: Record<string, number> = {};

  for (const log of seasonLogs) {
    const activity = activities.find(a => a.id === log.actId);
    if (!activity) continue;

    pawsByUser[log.ownerId] = (pawsByUser[log.ownerId] || 0) + activity.paws;
  }

  return pawsByUser;
}

/**
 * Подсчитать количество активностей по пользователям за сезон
 */
export function getSeasonActivitiesByUser(
  logs: LogEntry[],
  pet: Pet,
  seasonSettings: SeasonSettings,
  now: number = Date.now()
): Record<string, number> {
  const seasonLogs = getSeasonLogs(logs, pet, seasonSettings, now);
  const activitiesByUser: Record<string, number> = {};

  for (const log of seasonLogs) {
    activitiesByUser[log.ownerId] = (activitiesByUser[log.ownerId] || 0) + 1;
  }

  return activitiesByUser;
}

/**
 * Определить победителя сезона
 * Логика: лапки -> количество активностей -> ничья
 */
export function getSeasonWinner(
  logs: LogEntry[],
  activities: ActivityDef[],
  pet: Pet,
  seasonSettings: SeasonSettings,
  now: number = Date.now()
): { winnerId: string | null; pawsByUser: Record<string, number>; activitiesByUser: Record<string, number> } {
  const pawsByUser = getSeasonPawsByUser(logs, activities, pet, seasonSettings, now);
  const activitiesByUser = getSeasonActivitiesByUser(logs, pet, seasonSettings, now);

  const userIds = Object.keys(pawsByUser);
  if (userIds.length === 0) {
    return { winnerId: null, pawsByUser, activitiesByUser };
  }

  // Находим максимальное количество лапок
  const maxPaws = Math.max(...Object.values(pawsByUser));
  const leaders = userIds.filter(id => pawsByUser[id] === maxPaws);

  // Если один лидер - он победитель
  if (leaders.length === 1) {
    return { winnerId: leaders[0], pawsByUser, activitiesByUser };
  }

  // Ничья по лапкам - считаем количество активностей
  const maxActivities = Math.max(...leaders.map(id => activitiesByUser[id] || 0));
  const finalLeaders = leaders.filter(id => (activitiesByUser[id] || 0) === maxActivities);

  // Если один лидер по активностям - он победитель
  if (finalLeaders.length === 1) {
    return { winnerId: finalLeaders[0], pawsByUser, activitiesByUser };
  }

  // Полная ничья
  return { winnerId: null, pawsByUser, activitiesByUser };
}

/**
 * Закрыть месяц и сохранить результат
 * Краевой случай: если хозяин вышел из питомца, сохраняем результат с пометкой
 */
export function finalizeMonth(
  logs: LogEntry[],
  activities: ActivityDef[],
  pet: Pet,
  seasonSettings: SeasonSettings,
  existingResults: MonthlyResult[],
  month: string, // YYYY-MM
  now: number = Date.now()
): MonthlyResult {
  // Проверяем, есть ли уже результат за этот месяц
  const existing = existingResults.find(r => r.month === month && r.petId === pet.id);
  if (existing) {
    return existing;
  }

  // Получаем все логи за месяц
  const [year, monthNum] = month.split('-').map(Number);
  const monthStart = new Date(year, monthNum - 1, 1).getTime();
  const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999).getTime();

  const monthLogs = logs.filter(log =>
    log.petId === pet.id &&
    log.at >= monthStart &&
    log.at <= monthEnd
  );

  // Подсчитываем статистику
  const pawsByUser: Record<string, number> = {};
  const activitiesByUser: Record<string, number> = {};

  for (const log of monthLogs) {
    const activity = activities.find(a => a.id === log.actId);
    if (!activity) continue;

    pawsByUser[log.ownerId] = (pawsByUser[log.ownerId] || 0) + activity.paws;
    activitiesByUser[log.ownerId] = (activitiesByUser[log.ownerId] || 0) + 1;
  }

  // Определяем победителя
  const userIds = Object.keys(pawsByUser);
  let winnerId: string | null = null;
  let note: string | undefined;

  if (userIds.length > 0) {
    const maxPaws = Math.max(...Object.values(pawsByUser));
    const leaders = userIds.filter(id => pawsByUser[id] === maxPaws);

    if (leaders.length === 1) {
      winnerId = leaders[0];
    } else {
      // Ничья по лапкам
      const maxActivities = Math.max(...leaders.map(id => activitiesByUser[id] || 0));
      const finalLeaders = leaders.filter(id => (activitiesByUser[id] || 0) === maxActivities);

      if (finalLeaders.length === 1) {
        winnerId = finalLeaders[0];
      }
    }
  }

  // Краевой случай: проверяем, есть ли пользователи, которые больше не являются хозяевами
  const currentOwnerIds = new Set(pet.ownerIds);
  const previousOwners = Object.keys(pawsByUser).filter(id => !currentOwnerIds.has(id));
  
  if (previousOwners.length > 0) {
    note = `Результат включает данные бывших хозяев: ${previousOwners.length} чел.`;
  }

  return {
    petId: pet.id,
    month,
    winnerId,
    pawsByUser,
    activitiesByUser,
    finalizedAt: now,
    note,
  };
}

/**
 * Получить информацию о текущем сезоне
 */
export function getSeasonInfo(
  pet: Pet,
  seasonSettings: SeasonSettings,
  now: number = Date.now()
): {
  enabled: boolean;
  start: number;
  end: number;
  daysLeft: number;
  isLastDay: boolean;
} {
  const start = getSeasonStart(pet, seasonSettings, now);
  const end = getSeasonEnd(pet, seasonSettings, now);
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

  return {
    enabled: seasonSettings.enabled,
    start,
    end,
    daysLeft,
    isLastDay: daysLeft === 1,
  };
}

/**
 * Получить результаты по месяцам для питомца
 */
export function getMonthlyResults(
  pet: Pet
): MonthlyResult[] {
  return pet.monthlyResults ?? [];
}

/**
 * Получить чемпиона года (пользователь с наибольшим количеством побед)
 */
export function getYearlyChampion(
  pet: Pet,
  year: number
): string | null {
  const results = getMonthlyResults(pet);
  const yearResults = results.filter(r => {
    const resultYear = parseInt(r.month.split('-')[0]);
    return resultYear === year;
  });

  const winsByUser: Record<string, number> = {};
  for (const result of yearResults) {
    if (result.winnerId) {
      winsByUser[result.winnerId] = (winsByUser[result.winnerId] || 0) + 1;
    }
  }

  const maxWins = Math.max(0, ...Object.values(winsByUser));
  if (maxWins === 0) return null;

  const champions = Object.entries(winsByUser)
    .filter(([_, wins]) => wins === maxWins)
    .map(([userId]) => userId);

  return champions.length === 1 ? champions[0] : null;
}
