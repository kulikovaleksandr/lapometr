import type { Pet, VetEvent } from './types';

/**
 * Автографик прививок по виду и возрасту питомца
 * Генерирует серию событий при создании питомца
 */

interface ScheduleEvent {
  title: string;
  kind: VetEvent['kind'];
  ageWeeks: number;
  repeat?: 'none' | 'yearly';
  note?: string;
}

/**
 * Графики прививок для разных видов животных
 */
const SCHEDULES: Record<string, ScheduleEvent[]> = {
  cat: [
    { title: 'Первая комплексная прививка', kind: 'shot', ageWeeks: 8, note: 'Вирусный ринотрахеит, калицивироз, панлейкопения' },
    { title: 'Вторая комплексная прививка', kind: 'shot', ageWeeks: 12, note: 'Ревакцинация' },
    { title: 'Прививка от бешенства', kind: 'shot', ageWeeks: 12, note: 'Обязательна по закону' },
    { title: 'Ежегодная комплексная прививка', kind: 'shot', ageWeeks: 52, repeat: 'yearly', note: 'Ревакцинация' },
    { title: 'Ежегодная прививка от бешенства', kind: 'shot', ageWeeks: 52, repeat: 'yearly', note: 'Обязательна по закону' },
  ],
  dog: [
    { title: 'Первая комплексная прививка', kind: 'shot', ageWeeks: 8, note: 'Чума, парвовирус, гепатит' },
    { title: 'Вторая комплексная прививка', kind: 'shot', ageWeeks: 12, note: 'Ревакцинация + лептоспироз' },
    { title: 'Прививка от бешенства', kind: 'shot', ageWeeks: 12, note: 'Обязательна по закону' },
    { title: 'Ежегодная комплексная прививка', kind: 'shot', ageWeeks: 52, repeat: 'yearly', note: 'Ревакцинация' },
    { title: 'Ежегодная прививка от бешенства', kind: 'shot', ageWeeks: 52, repeat: 'yearly', note: 'Обязательна по закону' },
  ],
  rabbit: [
    { title: 'Прививка от ВГБК', kind: 'shot', ageWeeks: 6, note: 'Вирусная гемморагическая болезнь' },
    { title: 'Прививка от миксоматоза', kind: 'shot', ageWeeks: 8, note: 'Рекомендуется' },
    { title: 'Ежегодная ревакцинация ВГБК', kind: 'shot', ageWeeks: 52, repeat: 'yearly' },
    { title: 'Ежегодная ревакцинация миксоматоза', kind: 'shot', ageWeeks: 52, repeat: 'yearly' },
  ],
  parrot: [
    { title: 'Первый осмотр у орнитолога', kind: 'check', ageWeeks: 4, note: 'Общий осмотр' },
    { title: 'Ежегодный осмотр', kind: 'check', ageWeeks: 52, repeat: 'yearly' },
  ],
  hamster: [
    { title: 'Первый осмотр', kind: 'check', ageWeeks: 4, note: 'Общий осмотр' },
    { title: 'Ежегодный осмотр', kind: 'check', ageWeeks: 52, repeat: 'yearly' },
  ],
  fish: [
    { title: 'Проверка параметров воды', kind: 'check', ageWeeks: 2, note: 'pH, аммиак, нитриты, нитраты' },
    { title: 'Регулярная проверка воды', kind: 'check', ageWeeks: 4, repeat: 'yearly', note: 'Еженедельная проверка' },
  ],
};

/**
 * Генерирует ветеринарные события на основе вида и возраста питомца
 * @param pet - Питомец
 * @returns Массив ветеринарных событий
 */
export function generateVetEventsForPet(pet: Pet): VetEvent[] {
  const schedule = SCHEDULES[pet.species];
  if (!schedule) return [];

  // Вычисляем возраст питомца в неделях
  const birthDate = pet.birthday ? new Date(pet.birthday) : new Date();
  const now = new Date();
  const ageInWeeks = Math.floor((now.getTime() - birthDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

  const events: VetEvent[] = [];

  for (const item of schedule) {
    // Если питомец уже старше возраста прививки, пропускаем
    if (ageInWeeks > item.ageWeeks) continue;

    // Вычисляем дату события
    const eventDate = new Date(birthDate);
    eventDate.setDate(eventDate.getDate() + item.ageWeeks * 7);

    events.push({
      id: `vet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      petId: pet.id,
      kind: item.kind,
      title: item.title,
      date: eventDate.toISOString().split('T')[0],
      repeat: item.repeat || 'none',
      note: item.note,
    });
  }

  return events;
}

/**
 * Получает график прививок для вида питомца
 * @param species - Вид питомца
 * @returns Массив событий графика
 */
export function getScheduleForSpecies(species: string): ScheduleEvent[] {
  return SCHEDULES[species] || [];
}
