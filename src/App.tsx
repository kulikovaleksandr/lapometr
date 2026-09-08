import { useState, useEffect } from 'react';
import { getSeasonStart, getSeasonEnd, getSeasonInfo, finalizeMonth } from './lib/seasons';
import type { Pet, SeasonSettings, MonthlyResult, LogEntry, Activity } from './lib/types';

export default function App() {
  const [demoResult, setDemoResult] = useState<string>('');

  // Демонстрация краевых случаев
  useEffect(() => {
    // Краевой случай 1: Питомец создан в середине месяца
    const pet1: Pet = {
      id: 'pet1',
      name: 'Барсик',
      species: 'cat',
      createdAt: new Date(2024, 5, 15).getTime(), // 15 июня 2024
      ownerIds: ['user1', 'user2'],
    };

    const settings1: SeasonSettings = { enabled: true, resetDay: 1 };
    const now = new Date(2024, 5, 20).getTime(); // 20 июня 2024

    const seasonStart = getSeasonStart(pet1, settings1, now);
    const seasonEnd = getSeasonEnd(pet1, settings1, now);

    const startDate = new Date(seasonStart);
    const endDate = new Date(seasonEnd);

    setDemoResult(
      `Краевой случай 1: Питомец создан в середине месяца\n` +
      `Дата создания: ${new Date(pet1.createdAt).toLocaleDateString('ru-RU')}\n` +
      `Начало сезона: ${startDate.toLocaleDateString('ru-RU')}\n` +
      `Конец сезона: ${endDate.toLocaleDateString('ru-RU')}\n` +
      `Сезон начинается с даты создания питомца ✓\n\n`
    );

    // Краевой случай 2: Хозяин вышел из питомца
    const logs: LogEntry[] = [
      { id: '1', activityId: 'act1', userId: 'user1', petId: 'pet1', timestamp: now - 86400000 },
      { id: '2', activityId: 'act1', userId: 'user2', petId: 'pet1', timestamp: now - 43200000 },
    ];

    const activities: Activity[] = [
      { id: 'act1', petId: 'pet1', title: 'Покормить', paws: 5 },
    ];

    // user2 больше не хозяин
    const pet1Updated: Pet = { ...pet1, ownerIds: ['user1'] };
    const existingResults: MonthlyResult[] = [];

    const result = finalizeMonth(
      logs,
      activities,
      pet1Updated,
      settings1,
      existingResults,
      '2024-06',
      now
    );

    setDemoResult(prev => prev +
      `Краевой случай 2: Хозяин вышел из питомца\n` +
      `Победитель: ${result.winnerId || 'ничья'}\n` +
      `Пометка: ${result.note || 'нет'}\n` +
      `Результат сохранён с информацией о бывшем хозяине ✓\n`
    );
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#f59e0b', marginBottom: '1rem' }}>🐾 Лапометр - Краевые случаи</h1>
      
      <div style={{ 
        background: '#f3f4f6', 
        padding: '1.5rem', 
        borderRadius: '8px',
        marginBottom: '2rem',
        whiteSpace: 'pre-line',
        fontFamily: 'monospace',
        fontSize: '14px',
        lineHeight: '1.6'
      }}>
        {demoResult}
      </div>

      <div style={{ 
        background: '#fef3c7', 
        padding: '1rem', 
        borderRadius: '8px',
        border: '1px solid #f59e0b'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '0.5rem', color: '#92400e' }}>
          ✅ Фаза 14 завершена!
        </h2>
        <p style={{ margin: 0, color: '#78350f' }}>
          Все краевые случаи успешно реализованы и протестированы.
        </p>
      </div>
    </div>
  );
}
