import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { Modal, Btn } from './ui';
import { Icon } from './icons';
import { pawsOf, streakDays } from '../lib/db';

interface SocialShareCardProps {
  onClose: () => void;
}

export function SocialShareCard({ onClose }: SocialShareCardProps) {
  const { pet, acts, logs, user, now } = useApp();

  const stats = useMemo(() => {
    if (!pet) return null;

    // Фильтруем логи за последние 30 дней
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const recentLogs = logs.filter(l => l.petId === pet.id && l.at >= thirtyDaysAgo);

    // Общая статистика
    const totalPaws = pawsOf(acts, recentLogs);
    const totalActivities = recentLogs.length;
    const currentStreak = streakDays(logs, now);

    // Топ-3 активности
    const activityCounts = new Map<string, number>();
    recentLogs.forEach(log => {
      activityCounts.set(log.actId, (activityCounts.get(log.actId) || 0) + 1);
    });
    const topActivities = Array.from(activityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([actId, count]) => {
        const act = acts.find(a => a.id === actId);
        return { title: act?.title || 'Активность', count };
      });

    return {
      totalPaws,
      totalActivities,
      currentStreak,
      topActivities,
    };
  }, [pet, acts, logs, now]);

  if (!pet || !stats || !user) return null;

  const handleDownload = () => {
    // Создаём HTML для карточки
    const cardHtml = `
      <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 8px;">🐾</div>
          <h2 style="margin: 0; font-size: 24px; font-weight: bold;">Мои 30 дней заботы</h2>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">о ${pet.name}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
          <div style="text-align: center; background: rgba(255,255,255,0.2); padding: 16px; border-radius: 12px;">
            <div style="font-size: 32px; font-weight: bold;">${stats.totalPaws}</div>
            <div style="font-size: 12px; opacity: 0.9;">лапок</div>
          </div>
          <div style="text-align: center; background: rgba(255,255,255,0.2); padding: 16px; border-radius: 12px;">
            <div style="font-size: 32px; font-weight: bold;">${stats.totalActivities}</div>
            <div style="font-size: 12px; opacity: 0.9;">активностей</div>
          </div>
          <div style="text-align: center; background: rgba(255,255,255,0.2); padding: 16px; border-radius: 12px;">
            <div style="font-size: 32px; font-weight: bold;">${stats.currentStreak}</div>
            <div style="font-size: 12px; opacity: 0.9;">дней подряд</div>
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.2); padding: 16px; border-radius: 12px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold;">Топ активности:</h3>
          ${stats.topActivities.map((act, idx) => `
            <div style="display: flex; justify-content: space-between; margin-bottom: ${idx < stats.topActivities.length - 1 ? '8px' : '0'};">
              <span>${idx + 1}. ${act.title}</span>
              <span style="font-weight: bold;">${act.count}×</span>
            </div>
          `).join('')}
        </div>

        <div style="text-align: center; opacity: 0.8; font-size: 12px;">
          Создано в Лапометр • ${new Date(now).toLocaleDateString('ru-RU')}
        </div>
      </div>
    `;

    // Создаём blob и скачиваем
    const blob = new Blob([cardHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `30-days-${pet.name}-${new Date(now).toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal open={true} onClose={onClose} title="30 дней заботы">
      <div className="p-6">
        {/* Карточка */}
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 p-6 text-white">
          {/* Заголовок */}
          <div className="mb-6 text-center">
            <div className="mb-2 text-5xl">🐾</div>
            <h3 className="font-display text-2xl font-bold">Мои 30 дней заботы</h3>
            <p className="mt-2 text-sm opacity-90">о {pet.name}</p>
          </div>

          {/* Статистика */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-white/20 p-4 text-center">
              <div className="font-display text-3xl font-bold">{stats.totalPaws}</div>
              <div className="text-xs opacity-90">лапок</div>
            </div>
            <div className="rounded-xl bg-white/20 p-4 text-center">
              <div className="font-display text-3xl font-bold">{stats.totalActivities}</div>
              <div className="text-xs opacity-90">активностей</div>
            </div>
            <div className="rounded-xl bg-white/20 p-4 text-center">
              <div className="font-display text-3xl font-bold">{stats.currentStreak}</div>
              <div className="text-xs opacity-90">дней подряд</div>
            </div>
          </div>

          {/* Топ активности */}
          <div className="mb-6 rounded-xl bg-white/20 p-4">
            <h4 className="mb-3 text-sm font-bold">Топ активности:</h4>
            {stats.topActivities.map((act, idx) => (
              <div key={idx} className="mb-2 flex justify-between last:mb-0">
                <span>
                  {idx + 1}. {act.title}
                </span>
                <span className="font-bold">{act.count}×</span>
              </div>
            ))}
          </div>

          {/* Футер */}
          <div className="text-center text-xs opacity-80">
            Создано в Лапометр • {new Date(now).toLocaleDateString('ru-RU')}
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex gap-3">
          <Btn variant="ghost" onClick={onClose} className="flex-1">
            Закрыть
          </Btn>
          <Btn onClick={handleDownload} className="flex-1">
            <Icon name="download" size={16} />
            Скачать
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
