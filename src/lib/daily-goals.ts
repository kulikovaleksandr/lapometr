import type { ActivityDef, LogEntry, Pet } from './types';

export interface DailyGoal {
  id: string;
  actId: string;
  title: string;
  icon: string;
  color: string;
  target: number;
  current: number;
  completed: boolean;
}

// Приоритеты активностей (чем выше число, тем важнее)
const ACTIVITY_PRIORITIES: Record<string, number> = {
  feed: 10,      // Кормление - высший приоритет
  water: 9,      // Вода
  litter: 8,     // Лоток
  pet: 7,        // Погладить
  play: 6,       // Поиграть
  brush: 5,      // Вычесать
  eyes: 4,       // Глаза
  ears: 3,       // Уши
  nails: 2,      // Когти
  bath: 1,       // Купание
};

/**
 * Получить приоритет активности
 */
function getActivityPriority(act: ActivityDef): number {
  // Извлекаем тип активности из ID (формат: petId_slug)
  const slug = act.id.split('_').pop() || '';
  return ACTIVITY_PRIORITIES[slug] || 0;
}

/**
 * Рассчитать целевое количество активности на день
 */
function calculateDailyTarget(act: ActivityDef): number {
  // Если есть дневной лимит, используем его
  if (act.limitDay > 0) {
    return act.limitDay;
  }
  
  // Если есть напоминание, рассчитываем по remindH
  if (act.remindH > 0) {
    // Сколько раз в день нужно выполнить (24 часа / remindH)
    return Math.ceil(24 / act.remindH);
  }
  
  // По умолчанию - 1 раз в день
  return 1;
}

/**
 * Подсчитать текущее выполнение активности за сегодня
 */
function getCurrentCount(actId: string, logs: LogEntry[], today: Date): number {
  const todayStr = today.toISOString().split('T')[0];
  return logs.filter(log => {
    const logDate = new Date(log.at).toISOString().split('T')[0];
    return log.actId === actId && logDate === todayStr;
  }).length;
}

/**
 * Сгенерировать ежедневные цели для питомца
 */
export function generateDailyGoals(
  pet: Pet,
  activities: ActivityDef[],
  logs: LogEntry[]
): DailyGoal[] {
  const today = new Date();
  
  // Фильтруем активности для текущего питомца
  const petActivities = activities.filter(act => act.petId === pet.id);
  
  // Сортируем по приоритету (от высшего к низшему)
  const sorted = [...petActivities].sort((a, b) => 
    getActivityPriority(b) - getActivityPriority(a)
  );
  
  // Берем топ-7 активностей
  const topActivities = sorted.slice(0, 7);
  
  // Генерируем цели
  return topActivities.map(act => {
    const target = calculateDailyTarget(act);
    const current = getCurrentCount(act.id, logs, today);
    const completed = current >= target;
    
    return {
      id: `goal_${act.id}`,
      actId: act.id,
      title: act.title,
      icon: act.icon,
      color: act.color,
      target,
      current: Math.min(current, target), // Не показываем больше цели
      completed,
    };
  });
}

/**
 * Рассчитать общий прогресс выполнения целей
 */
export function calculateDailyProgress(goals: DailyGoal[]): {
  completed: number;
  total: number;
  percentage: number;
} {
  const completed = goals.filter(g => g.completed).length;
  const total = goals.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return { completed, total, percentage };
}

/**
 * Получить текст статуса выполнения дня
 */
export function getDailyStatusText(percentage: number): string {
  if (percentage === 0) return 'Начните день с заботы о питомце';
  if (percentage < 30) return 'Хорошее начало! Продолжайте';
  if (percentage < 60) return 'Отличный прогресс!';
  if (percentage < 100) return 'Почти готово! Осталось немного';
  return 'Все цели выполнены! 🎉';
}

/**
 * Получить эмодзи для статуса
 */
export function getDailyStatusEmoji(percentage: number): string {
  if (percentage === 0) return '🌅';
  if (percentage < 30) return '👍';
  if (percentage < 60) return '💪';
  if (percentage < 100) return '🔥';
  return '🏆';
}
