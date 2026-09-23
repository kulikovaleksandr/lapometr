import type { LogEntry, Pet, User } from './types';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  check: (context: AchievementContext) => boolean;
}

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  check: (context: AchievementContext) => number;
}

export interface AchievementContext {
  user: User;
  pet: Pet;
  logs: LogEntry[];
  allLogs: LogEntry[];
  now: number;
}

// 15 ачивок 4 уровней редкости
export const ACHIEVEMENTS: Achievement[] = [
  // Обычные (5)
  {
    id: 'first_paw',
    title: 'Первая лапка',
    description: 'Отметь первую активность для питомца',
    icon: '🐾',
    rarity: 'common',
    check: (ctx) => ctx.allLogs.length >= 1,
  },
  {
    id: 'hundred_paws',
    title: 'Сотня лапок',
    description: 'Набери 100 лапок за все время',
    icon: '💯',
    rarity: 'common',
    check: (ctx) => {
      const totalPaws = ctx.allLogs.reduce((sum, log) => {
        return sum + 5; // приблизительно 5 лапок на запись
      }, 0);
      return totalPaws >= 100;
    },
  },
  {
    id: 'week_streak',
    title: 'Недельная серия',
    description: 'Отмечай активности 7 дней подряд',
    icon: '🔥',
    rarity: 'common',
    check: (ctx) => {
      const userLogs = ctx.allLogs.filter(l => l.ownerId === ctx.user.id);
      if (userLogs.length === 0) return false;
      
      const days = new Set<string>();
      userLogs.forEach(log => {
        const date = new Date(log.at).toISOString().split('T')[0];
        days.add(date);
      });
      
      const sortedDays = Array.from(days).sort().reverse();
      let streak = 0;
      const today = new Date(ctx.now);
      
      for (let i = 0; i < sortedDays.length; i++) {
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedStr = expectedDate.toISOString().split('T')[0];
        
        if (sortedDays[i] === expectedStr) {
          streak++;
        } else {
          break;
        }
      }
      
      return streak >= 7;
    },
  },
  {
    id: 'early_bird',
    title: 'Ранняя пташка',
    description: 'Отметь активность до 7 утра',
    icon: '🌅',
    rarity: 'common',
    check: (ctx) => {
      return ctx.allLogs.some(log => {
        const hour = new Date(log.at).getHours();
        return hour < 7;
      });
    },
  },
  {
    id: 'night_owl',
    title: 'Ночная сова',
    description: 'Отметь активность после 22 часов',
    icon: '🦉',
    rarity: 'common',
    check: (ctx) => {
      return ctx.allLogs.some(log => {
        const hour = new Date(log.at).getHours();
        return hour >= 22;
      });
    },
  },

  // Редкие (5)
  {
    id: 'thousand_paws',
    title: 'Тысяча лапок',
    description: 'Набери 1000 лапок за все время',
    icon: '⭐',
    rarity: 'rare',
    check: (ctx) => {
      const totalPaws = ctx.allLogs.length * 5;
      return totalPaws >= 1000;
    },
  },
  {
    id: 'month_streak',
    title: 'Месячная серия',
    description: 'Отмечай активности 30 дней подряд',
    icon: '🏆',
    rarity: 'rare',
    check: (ctx) => {
      const userLogs = ctx.allLogs.filter(l => l.ownerId === ctx.user.id);
      if (userLogs.length === 0) return false;
      
      const days = new Set<string>();
      userLogs.forEach(log => {
        const date = new Date(log.at).toISOString().split('T')[0];
        days.add(date);
      });
      
      const sortedDays = Array.from(days).sort().reverse();
      let streak = 0;
      const today = new Date(ctx.now);
      
      for (let i = 0; i < sortedDays.length; i++) {
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedStr = expectedDate.toISOString().split('T')[0];
        
        if (sortedDays[i] === expectedStr) {
          streak++;
        } else {
          break;
        }
      }
      
      return streak >= 30;
    },
  },
  {
    id: 'variety_master',
    title: 'Мастер разнообразия',
    description: 'Выполни все 12 стандартных активностей',
    icon: '🎨',
    rarity: 'rare',
    check: (ctx) => {
      const userLogs = ctx.allLogs.filter(l => l.ownerId === ctx.user.id);
      const uniqueActs = new Set(userLogs.map(l => l.actId));
      return uniqueActs.size >= 12;
    },
  },
  {
    id: 'photo_collector',
    title: 'Фотоколлекционер',
    description: 'Добавь фото к 10 активностям',
    icon: '📸',
    rarity: 'rare',
    check: (ctx) => {
      const withPhotos = ctx.allLogs.filter(l => l.img);
      return withPhotos.length >= 10;
    },
  },
  {
    id: 'dedicated_caregiver',
    title: 'Преданный опекун',
    description: 'Отметь 50 активностей за месяц',
    icon: '💪',
    rarity: 'rare',
    check: (ctx) => {
      const userLogs = ctx.allLogs.filter(l => l.ownerId === ctx.user.id);
      const monthAgo = ctx.now - 30 * 24 * 60 * 60 * 1000;
      const recentLogs = userLogs.filter(l => l.at >= monthAgo);
      return recentLogs.length >= 50;
    },
  },

  // Эпические (3)
  {
    id: 'perfect_day',
    title: 'Идеальный день',
    description: 'Выполни все типы активностей за один день',
    icon: '✨',
    rarity: 'epic',
    check: (ctx) => {
      const userLogs = ctx.allLogs.filter(l => l.ownerId === ctx.user.id);
      const days = new Map<string, Set<string>>();
      
      userLogs.forEach(log => {
        const date = new Date(log.at).toISOString().split('T')[0];
        if (!days.has(date)) {
          days.set(date, new Set());
        }
        days.get(date)!.add(log.actId);
      });
      
      for (const [, acts] of days) {
        if (acts.size >= 12) return true;
      }
      return false;
    },
  },
  {
    id: 'five_thousand_paws',
    title: 'Пять тысяч лапок',
    description: 'Набери 5000 лапок за все время',
    icon: '🌟',
    rarity: 'epic',
    check: (ctx) => {
      const totalPaws = ctx.allLogs.length * 5;
      return totalPaws >= 5000;
    },
  },
  {
    id: 'year_streak',
    title: 'Годовая серия',
    description: 'Отмечай активности 365 дней подряд',
    icon: '👑',
    rarity: 'epic',
    check: (ctx) => {
      const userLogs = ctx.allLogs.filter(l => l.ownerId === ctx.user.id);
      if (userLogs.length === 0) return false;
      
      const days = new Set<string>();
      userLogs.forEach(log => {
        const date = new Date(log.at).toISOString().split('T')[0];
        days.add(date);
      });
      
      const sortedDays = Array.from(days).sort().reverse();
      let streak = 0;
      const today = new Date(ctx.now);
      
      for (let i = 0; i < sortedDays.length; i++) {
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedStr = expectedDate.toISOString().split('T')[0];
        
        if (sortedDays[i] === expectedStr) {
          streak++;
        } else {
          break;
        }
      }
      
      return streak >= 365;
    },
  },

  // Легендарные (2)
  {
    id: 'ten_thousand_paws',
    title: 'Десять тысяч лапок',
    description: 'Набери 10000 лапок за все время',
    icon: '💎',
    rarity: 'legendary',
    check: (ctx) => {
      const totalPaws = ctx.allLogs.length * 5;
      return totalPaws >= 10000;
    },
  },
  {
    id: 'ultimate_caregiver',
    title: 'Идеальный хозяин',
    description: 'Отметь 1000 активностей за все время',
    icon: '🏅',
    rarity: 'legendary',
    check: (ctx) => {
      return ctx.allLogs.length >= 1000;
    },
  },
];

// 5 еженедельных челленджей
export const WEEKLY_CHALLENGES: WeeklyChallenge[] = [
  {
    id: 'week_feed_20',
    title: 'Кормилец недели',
    description: 'Покорми питомца 20 раз за неделю',
    icon: '🍽️',
    target: 20,
    check: (ctx) => {
      const weekAgo = ctx.now - 7 * 24 * 60 * 60 * 1000;
      const feedLogs = ctx.allLogs.filter(l => 
        l.ownerId === ctx.user.id && 
        l.at >= weekAgo &&
        l.actId.includes('feed')
      );
      return feedLogs.length;
    },
  },
  {
    id: 'week_pet_30',
    title: 'Ласковый хозяин',
    description: 'Погладь питомца 30 раз за неделю',
    icon: '🤗',
    target: 30,
    check: (ctx) => {
      const weekAgo = ctx.now - 7 * 24 * 60 * 60 * 1000;
      const petLogs = ctx.allLogs.filter(l => 
        l.ownerId === ctx.user.id && 
        l.at >= weekAgo &&
        l.actId.includes('pet')
      );
      return petLogs.length;
    },
  },
  {
    id: 'week_play_10',
    title: 'Игроман',
    description: 'Поиграй с питомцем 10 раз за неделю',
    icon: '🎮',
    target: 10,
    check: (ctx) => {
      const weekAgo = ctx.now - 7 * 24 * 60 * 60 * 1000;
      const playLogs = ctx.allLogs.filter(l => 
        l.ownerId === ctx.user.id && 
        l.at >= weekAgo &&
        l.actId.includes('play')
      );
      return playLogs.length;
    },
  },
  {
    id: 'week_litter_7',
    title: 'Чистюля',
    description: 'Поменяй лоток 7 раз за неделю',
    icon: '🧹',
    target: 7,
    check: (ctx) => {
      const weekAgo = ctx.now - 7 * 24 * 60 * 60 * 1000;
      const litterLogs = ctx.allLogs.filter(l => 
        l.ownerId === ctx.user.id && 
        l.at >= weekAgo &&
        l.actId.includes('litter')
      );
      return litterLogs.length;
    },
  },
  {
    id: 'week_total_50',
    title: 'Активная неделя',
    description: 'Отметь 50 активностей за неделю',
    icon: '📊',
    target: 50,
    check: (ctx) => {
      const weekAgo = ctx.now - 7 * 24 * 60 * 60 * 1000;
      const recentLogs = ctx.allLogs.filter(l => 
        l.ownerId === ctx.user.id && 
        l.at >= weekAgo
      );
      return recentLogs.length;
    },
  },
];

// Функции для работы с ачивками
export function getUnlockedAchievements(context: AchievementContext): string[] {
  return ACHIEVEMENTS
    .filter(ach => ach.check(context))
    .map(ach => ach.id);
}

export function isAchievementUnlocked(achievementId: string, context: AchievementContext): boolean {
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement) return false;
  return achievement.check(context);
}

export function getChallengeProgress(challengeId: string, context: AchievementContext): { current: number; target: number; completed: boolean } {
  const challenge = WEEKLY_CHALLENGES.find(c => c.id === challengeId);
  if (!challenge) return { current: 0, target: 0, completed: false };
  
  const current = challenge.check(context);
  return {
    current,
    target: challenge.target,
    completed: current >= challenge.target,
  };
}

export function getAchievementStats(context: AchievementContext) {
  const unlocked = getUnlockedAchievements(context);
  const total = ACHIEVEMENTS.length;
  
  const byRarity = {
    common: ACHIEVEMENTS.filter(a => a.rarity === 'common'),
    rare: ACHIEVEMENTS.filter(a => a.rarity === 'rare'),
    epic: ACHIEVEMENTS.filter(a => a.rarity === 'epic'),
    legendary: ACHIEVEMENTS.filter(a => a.rarity === 'legendary'),
  };
  
  const unlockedByRarity = {
    common: unlocked.filter(id => byRarity.common.some(a => a.id === id)).length,
    rare: unlocked.filter(id => byRarity.rare.some(a => a.id === id)).length,
    epic: unlocked.filter(id => byRarity.epic.some(a => a.id === id)).length,
    legendary: unlocked.filter(id => byRarity.legendary.some(a => a.id === id)).length,
  };
  
  return {
    unlocked: unlocked.length,
    total,
    percentage: Math.round((unlocked.length / total) * 100),
    byRarity: unlockedByRarity,
    totalByRarity: {
      common: byRarity.common.length,
      rare: byRarity.rare.length,
      epic: byRarity.epic.length,
      legendary: byRarity.legendary.length,
    },
  };
}

export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'common': return '#9CA3AF';
    case 'rare': return '#3B82F6';
    case 'epic': return '#A855F7';
    case 'legendary': return '#F59E0B';
    default: return '#9CA3AF';
  }
}

export function getRarityName(rarity: string): string {
  switch (rarity) {
    case 'common': return 'Обычная';
    case 'rare': return 'Редкая';
    case 'epic': return 'Эпическая';
    case 'legendary': return 'Легендарная';
    default: return 'Обычная';
  }
}
