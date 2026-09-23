import type { WeightEntry, Species } from './types';

/**
 * Нормальный диапазон веса по виду животного (в кг)
 */
export const WEIGHT_RANGES: Record<Species, { min: number; max: number; unit: string }> = {
  cat: { min: 3, max: 6, unit: 'кг' },
  dog: { min: 5, max: 40, unit: 'кг' },
  rabbit: { min: 1, max: 5, unit: 'кг' },
  parrot: { min: 0.03, max: 0.5, unit: 'кг' },
  hamster: { min: 0.02, max: 0.15, unit: 'кг' },
  fish: { min: 0.01, max: 1, unit: 'кг' },
};

/**
 * Оценка веса питомца
 */
export function assessWeight(weight: number, species: Species): {
  status: 'underweight' | 'normal' | 'overweight';
  message: string;
  color: string;
} {
  const range = WEIGHT_RANGES[species];
  if (!range) {
    return { status: 'normal', message: 'Данные недоступны', color: '#888' };
  }

  if (weight < range.min) {
    return {
      status: 'underweight',
      message: `Недостаточный вес (норма: ${range.min}-${range.max} ${range.unit})`,
      color: '#f59e0b',
    };
  } else if (weight > range.max) {
    return {
      status: 'overweight',
      message: `Избыточный вес (норма: ${range.min}-${range.max} ${range.unit})`,
      color: '#ef4444',
    };
  } else {
    return {
      status: 'normal',
      message: `Нормальный вес (${range.min}-${range.max} ${range.unit})`,
      color: '#10b981',
    };
  }
}

/**
 * Расчёт дозировки препарата от глистов по весу
 */
export function calculateDewormingDose(weight: number): {
  drug: string;
  dose: number;
  unit: string;
  instructions: string;
} {
  // Стандартная дозировка: 1 мг на 1 кг веса
  const dose = weight * 1;
  
  return {
    drug: 'Препарат от глистов',
    dose: Math.round(dose * 100) / 100,
    unit: 'мг',
    instructions: `Дать ${Math.round(dose * 100) / 100} мг препарата. Повторить через 2 недели.`,
  };
}

/**
 * Получение последних записей веса
 */
export function getRecentWeights(weights: WeightEntry[], petId: string, limit: number = 10): WeightEntry[] {
  return weights
    .filter(w => w.petId === petId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

/**
 * Получение текущего (последнего) веса
 */
export function getCurrentWeight(weights: WeightEntry[], petId: string): WeightEntry | null {
  const recent = getRecentWeights(weights, petId, 1);
  return recent.length > 0 ? recent[0] : null;
}

/**
 * Расчёт изменения веса
 */
export function calculateWeightChange(weights: WeightEntry[], petId: string): {
  change: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
} {
  const recent = getRecentWeights(weights, petId, 2);
  
  if (recent.length < 2) {
    return { change: 0, percentage: 0, trend: 'stable' };
  }

  const current = recent[0].weight;
  const previous = recent[1].weight;
  const change = current - previous;
  const percentage = previous > 0 ? (change / previous) * 100 : 0;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(percentage) > 1) {
    trend = change > 0 ? 'up' : 'down';
  }

  return { change, percentage, trend };
}

/**
 * Подготовка данных для графика веса
 */
export function prepareWeightChartData(weights: WeightEntry[], petId: string): {
  dates: string[];
  values: number[];
  labels: string[];
} {
  const recent = getRecentWeights(weights, petId, 30);
  const sorted = [...recent].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    dates: sorted.map(w => w.date),
    values: sorted.map(w => w.weight),
    labels: sorted.map(w => new Date(w.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })),
  };
}
