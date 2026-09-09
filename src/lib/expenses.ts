import type { Expense, ExpenseCategory } from './types';

/**
 * Категории расходов с метаданными
 */
export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; icon: string; color: string }> = {
  food: { label: 'Корм', icon: 'feed', color: '#f59e0b' },
  litter: { label: 'Наполнитель', icon: 'litter', color: '#8b5cf6' },
  vet: { label: 'Ветеринар', icon: 'stetho', color: '#ef4444' },
  toys: { label: 'Игрушки', icon: 'play', color: '#10b981' },
  accessories: { label: 'Аксессуары', icon: 'heart', color: '#ec4899' },
  grooming: { label: 'Груминг', icon: 'brush', color: '#06b6d4' },
  other: { label: 'Другое', icon: 'spark', color: '#6b7280' },
};

/**
 * Получить метаданные категории
 */
export function getCategoryInfo(category: ExpenseCategory) {
  return EXPENSE_CATEGORIES[category] || EXPENSE_CATEGORIES.other;
}

/**
 * Подсчитать общую сумму расходов
 */
export function calculateTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, exp) => sum + exp.amount, 0);
}

/**
 * Подсчитать сумму по категории
 */
export function calculateByCategory(expenses: Expense[]): Record<ExpenseCategory, number> {
  const result: Record<ExpenseCategory, number> = {
    food: 0,
    litter: 0,
    vet: 0,
    toys: 0,
    accessories: 0,
    grooming: 0,
    other: 0,
  };

  expenses.forEach(exp => {
    result[exp.category] = (result[exp.category] || 0) + exp.amount;
  });

  return result;
}

/**
 * Подсчитать сумму по месяцам
 */
export function calculateByMonth(expenses: Expense[]): Record<string, number> {
  const result: Record<string, number> = {};

  expenses.forEach(exp => {
    const date = new Date(exp.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    result[monthKey] = (result[monthKey] || 0) + exp.amount;
  });

  return result;
}

/**
 * Получить расходы за конкретный месяц
 */
export function getExpensesByMonth(expenses: Expense[], year: number, month: number): Expense[] {
  return expenses.filter(exp => {
    const date = new Date(exp.date);
    return date.getFullYear() === year && date.getMonth() === month;
  });
}

/**
 * Форматировать сумму в рублях
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Получить последние N расходов
 */
export function getRecentExpenses(expenses: Expense[], count: number = 10): Expense[] {
  return [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, count);
}

/**
 * Получить список доступных месяцев с расходами
 */
export function getAvailableMonths(expenses: Expense[]): Array<{ year: number; month: number; key: string }> {
  const months = new Set<string>();

  expenses.forEach(exp => {
    const date = new Date(exp.date);
    months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  });

  return Array.from(months)
    .map(key => {
      const [year, month] = key.split('-').map(Number);
      return { year, month, key };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
}
