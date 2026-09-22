import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { Reveal } from './ui';
import { Icon } from './icons';
import {
  generateDailyGoals,
  calculateDailyProgress,
  getDailyStatusText,
  getDailyStatusEmoji,
} from '../lib/daily-goals';

export function DailyGoals() {
  const { pet, acts, logs } = useApp();

  // Генерируем цели
  const goals = useMemo(
    () => (pet ? generateDailyGoals(pet, acts, logs) : []),
    [pet, acts, logs]
  );

  // Рассчитываем прогресс
  const progress = useMemo(
    () => calculateDailyProgress(goals),
    [goals]
  );

  const statusText = getDailyStatusText(progress.percentage);
  const statusEmoji = getDailyStatusEmoji(progress.percentage);

  // Если нет целей, не показываем компонент
  if (goals.length === 0) {
    return null;
  }

  // Параметры прогресс-кольца
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress.percentage / 100) * circumference;

  return (
    <Reveal>
      <section className="card p-6">
        <div className="mb-5 flex items-center gap-4">
          {/* Прогресс-кольцо */}
          <div className="relative">
            <svg width="100" height="100" className="transform -rotate-90">
              {/* Фоновый круг */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="var(--line)"
                strokeWidth="8"
                fill="none"
              />
              {/* Прогресс */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="var(--accent)"
                strokeWidth="8"
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            {/* Центр с текстом */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl">{statusEmoji}</div>
              <div className="text-sm font-bold text-ink">{progress.percentage}%</div>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold">
              План на день
            </h3>
            <p className="text-sm text-mute mt-1">{statusText}</p>
            <p className="text-xs text-mute mt-2">
              {progress.completed} из {progress.total} целей выполнено
            </p>
          </div>
        </div>

        {/* Чек-лист целей */}
        <div className="space-y-2">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                goal.completed
                  ? 'border-ok/30 bg-ok/5'
                  : 'border-line bg-bg2/50 hover:border-accent/50'
              }`}
            >
              {/* Иконка активности */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: `color-mix(in oklab, ${goal.color} 20%, transparent)`,
                  color: goal.color,
                }}
              >
                <Icon name={goal.icon as any} size={20} />
              </div>

              {/* Информация о цели */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-medium ${
                      goal.completed ? 'text-mute line-through' : 'text-ink'
                    }`}
                  >
                    {goal.title}
                  </span>
                  {goal.completed && (
                    <Icon name="check" size={16} className="shrink-0 text-ok" />
                  )}
                </div>

                {/* Прогресс-бар */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raise">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(goal.current / goal.target) * 100}%`,
                        background: goal.completed ? 'var(--ok)' : goal.color,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-medium text-mute">
                    {goal.current}/{goal.target}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Подсказка */}
        {progress.percentage < 100 && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-xs text-mute">
            <Icon name="info" size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>
              Отмечайте активности в разделе «Быстрые активности» ниже — цели будут выполняться автоматически
            </span>
          </div>
        )}
      </section>
    </Reveal>
  );
}
