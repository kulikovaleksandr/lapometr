import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Reveal } from './ui';
import { Icon } from './icons';
import {
  ACHIEVEMENTS,
  WEEKLY_CHALLENGES,
  getUnlockedAchievements,
  getChallengeProgress,
  getAchievementStats,
  getRarityColor,
  getRarityName,
  type AchievementContext,
} from '../lib/achievements';

export function AchievementsPanel() {
  const { user, pet, logs, now } = useApp();
  const [selectedTab, setSelectedTab] = useState<'achievements' | 'challenges'>('achievements');

  if (!user || !pet) return null;

  const context: AchievementContext = {
    user,
    pet,
    logs: logs.filter(l => l.petId === pet.id),
    allLogs: logs,
    now,
  };

  const stats = getAchievementStats(context);
  const unlockedIds = getUnlockedAchievements(context);

  return (
    <div className="space-y-5">
      {/* Заголовок с общей статистикой */}
      <Reveal>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Icon name="trophy" size={24} className="text-accent" />
                Достижения
              </h2>
              <p className="text-sm text-mute mt-1">
                {stats.unlocked} из {stats.total} получено ({stats.percentage}%)
              </p>
            </div>
          </div>

          {/* Прогресс-бар */}
          <div className="relative h-3 bg-bg2 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-accent/70 transition-all duration-500"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>

          {/* Статистика по редкостям */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {(['common', 'rare', 'epic', 'legendary'] as const).map(rarity => (
              <div key={rarity} className="bg-bg2 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getRarityColor(rarity) }}
                  />
                  <span className="text-xs font-medium text-mute">{getRarityName(rarity)}</span>
                </div>
                <p className="text-lg font-bold">
                  {stats.byRarity[rarity]}
                  <span className="text-sm text-mute font-normal">/{stats.totalByRarity[rarity]}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Переключатель вкладок */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedTab('achievements')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            selectedTab === 'achievements'
              ? 'bg-accent text-accent-ink'
              : 'bg-bg2 text-mute hover:bg-bg2/70'
          }`}
        >
          🏆 Ачивки
        </button>
        <button
          onClick={() => setSelectedTab('challenges')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            selectedTab === 'challenges'
              ? 'bg-accent text-accent-ink'
              : 'bg-bg2 text-mute hover:bg-bg2/70'
          }`}
        >
          🎯 Челленджи
        </button>
      </div>

      {/* Контент вкладок */}
      {selectedTab === 'achievements' ? (
        <AchievementsList context={context} unlockedIds={unlockedIds} />
      ) : (
        <ChallengesList context={context} />
      )}
    </div>
  );
}

function AchievementsList({ context, unlockedIds }: { context: AchievementContext; unlockedIds: string[] }) {
  const grouped = {
    legendary: ACHIEVEMENTS.filter(a => a.rarity === 'legendary'),
    epic: ACHIEVEMENTS.filter(a => a.rarity === 'epic'),
    rare: ACHIEVEMENTS.filter(a => a.rarity === 'rare'),
    common: ACHIEVEMENTS.filter(a => a.rarity === 'common'),
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([rarity, achievements]) => (
        <Reveal key={rarity}>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-6 rounded-full"
                style={{ backgroundColor: getRarityColor(rarity) }}
              />
              <h3 className="font-display text-lg font-bold">{getRarityName(rarity)}</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {achievements.map(achievement => {
                const unlocked = unlockedIds.includes(achievement.id);
                return (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    unlocked={unlocked}
                  />
                );
              })}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function AchievementCard({ achievement, unlocked }: { achievement: typeof ACHIEVEMENTS[0]; unlocked: boolean }) {
  return (
    <div
      className={`card p-4 transition-all ${
        unlocked ? 'opacity-100' : 'opacity-50 grayscale'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 ${
            unlocked ? 'bg-accent/20' : 'bg-bg2'
          }`}
        >
          {achievement.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-sm">{achievement.title}</h4>
            {unlocked && (
              <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">
                ✓
              </span>
            )}
          </div>
          <p className="text-xs text-mute">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}

function ChallengesList({ context }: { context: AchievementContext }) {
  return (
    <div className="space-y-3">
      {WEEKLY_CHALLENGES.map(challenge => {
        const progress = getChallengeProgress(challenge.id, context);
        const percentage = Math.min(100, Math.round((progress.current / progress.target) * 100));
        
        return (
          <Reveal key={challenge.id}>
            <div className="card p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center text-2xl flex-shrink-0">
                  {challenge.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm mb-1">{challenge.title}</h4>
                  <p className="text-xs text-mute">{challenge.description}</p>
                </div>
                {progress.completed && (
                  <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full font-medium">
                    ✓ Выполнено
                  </span>
                )}
              </div>

              {/* Прогресс-бар */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-mute">Прогресс</span>
                  <span className="font-medium">
                    {progress.current} / {progress.target}
                  </span>
                </div>
                <div className="relative h-2 bg-bg2 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                      progress.completed
                        ? 'bg-gradient-to-r from-green-500 to-green-400'
                        : 'bg-gradient-to-r from-accent to-accent/70'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
