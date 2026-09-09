import { useApp } from '../state/AppContext';
import { Icon } from './icons';
import { UserAvatar } from './ui';

export function Trophy() {
  const { monthlyResults, owners, seasonInfo, yearlyChampion } = useApp();

  if (!monthlyResults || monthlyResults.length === 0) {
    return null;
  }

  // Сортируем результаты по дате (новые первые)
  const sortedResults = [...monthlyResults].sort((a, b) => {
    return new Date(b.month).getTime() - new Date(a.month).getTime();
  });

  // Находим чемпиона года
  const championId = yearlyChampion;
  const champion = championId ? owners.find(o => o.id === championId) : null;
  const championWins = championId 
    ? monthlyResults.filter(r => r.winnerId === championId).length
    : 0;

  return (
    <div className="space-y-4">
      {/* Текущий сезон */}
      {seasonInfo.enabled && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Icon name="trophy" size={24} className="text-accent" />
                <span 
                  className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent"
                  style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Текущий сезон</p>
                <p className="text-xs text-muted">
                  {new Date(seasonInfo.start).toLocaleDateString('ru-RU', { month: 'long' })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Осталось</p>
              <p className="text-sm font-bold text-accent">
                {seasonInfo.daysLeft} {seasonInfo.daysLeft === 1 ? 'день' : 'дней'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Чемпион года */}
      {champion && (
        <div className="card p-4 bg-gradient-to-br from-accent/10 to-accent/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <UserAvatar user={champion} size={48} />
              <div className="absolute -top-1 -right-1 bg-accent rounded-full p-1">
                <Icon name="crown" size={14} className="text-accent-ink" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-ink">Чемпион года</p>
              <p className="text-xs text-muted">
                {champion.name} — {championWins} из {monthlyResults.length} месяцев
              </p>
            </div>
          </div>
        </div>
      )}

      {/* История победителей по месяцам */}
      <div className="card p-4">
        <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
          <Icon name="trophy" size={16} className="text-accent" />
          История победителей
        </h3>
        <div className="space-y-2">
          {sortedResults.map((result) => {
            const winner = owners.find(o => o.id === result.winnerId);
            const monthDate = new Date(result.month + '-01');
            const monthName = monthDate.toLocaleDateString('ru-RU', { 
              month: 'long', 
              year: 'numeric' 
            });

            return (
              <div 
                key={result.month}
                className="flex items-center gap-3 p-2 rounded-lg bg-surface/50 hover:bg-surface transition-colors"
              >
                <div className="flex-shrink-0">
                  <Icon name="crown" size={20} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted">{monthName}</p>
                  {winner ? (
                    <div className="flex items-center gap-2">
                      <UserAvatar user={winner} size={24} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-ink truncate">{winner.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <Icon name="paw" size={12} />
                            {result.pawsByUser[winner.id] || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Icon name="spark" size={12} />
                            {result.activitiesByUser[winner.id] || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted italic">Ничья</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
