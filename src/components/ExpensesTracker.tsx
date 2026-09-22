import { useState, useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { Btn, Modal, Field } from './ui';
import { Icon } from './icons';
import {
  EXPENSE_CATEGORIES,
  calculateTotal,
  calculateByCategory,
  calculateByMonth,
  formatAmount,
  getExpensesByMonth,
  getAvailableMonths,
} from '../lib/expenses';
import type { Expense, ExpenseCategory } from '../lib/types';

export function ExpensesTracker() {
  const { pet, db, addExpense, updateExpense, deleteExpense, toast } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  if (!pet) return null;

  const petExpenses = db.expenses.filter(e => e.petId === pet.id);
  const monthExpenses = getExpensesByMonth(petExpenses, selectedMonth.year, selectedMonth.month);
  const total = calculateTotal(monthExpenses);
  const byCategory = calculateByCategory(monthExpenses);
  const availableMonths = getAvailableMonths(petExpenses);

  const handleAdd = (data: { category: ExpenseCategory; amount: number; date: string; description?: string }) => {
    const error = addExpense({ petId: pet.id, ...data });
    if (!error) {
      setShowForm(false);
    } else {
      toast(error, 'err');
    }
  };

  const handleUpdate = (id: string, data: Partial<Expense>) => {
    updateExpense(id, data);
    setEditingExpense(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить этот расход?')) {
      deleteExpense(id);
    }
  };

  const navigateMonth = (direction: -1 | 1) => {
    const newDate = new Date(selectedMonth.year, selectedMonth.month + direction, 1);
    setSelectedMonth({ year: newDate.getFullYear(), month: newDate.getMonth() });
  };

  const monthName = new Date(selectedMonth.year, selectedMonth.month).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-5">
      {/* Заголовок с навигацией по месяцам */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Icon name="chart" size={24} className="text-accent" />
            Учёт расходов
          </h2>
          <Btn size="sm" onClick={() => setShowForm(true)}>
            <Icon name="plus" size={16} />
            Добавить расход
          </Btn>
        </div>

        {/* Навигация по месяцам */}
        <div className="flex items-center justify-between mb-4">
          <Btn variant="ghost" size="sm" onClick={() => navigateMonth(-1)}>
            <Icon name="chev" size={16} className="rotate-180" />
          </Btn>
          <span className="font-display text-lg font-bold">{monthName}</span>
          <Btn variant="ghost" size="sm" onClick={() => navigateMonth(1)}>
            <Icon name="chev" size={16} />
          </Btn>
        </div>

        {/* Общая сумма */}
        <div className="bg-accent/10 rounded-lg p-4 text-center">
          <p className="text-sm text-mute mb-1">Всего за месяц</p>
          <p className="text-3xl font-bold text-accent">{formatAmount(total)}</p>
        </div>
      </div>

      {/* Разбивка по категориям */}
      {Object.keys(byCategory).length > 0 && (
        <div className="card p-5">
          <h3 className="font-display text-lg font-bold mb-4">По категориям</h3>
          <div className="space-y-3">
            {Object.entries(byCategory)
              .filter(([_, amount]) => amount > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount]) => {
                const info = EXPENSE_CATEGORIES[category as ExpenseCategory];
                const percentage = total > 0 ? (amount / total) * 100 : 0;
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: `${info.color}20`, color: info.color }}
                        >
                          <Icon name={info.icon as any} size={16} />
                        </div>
                        <span className="font-medium">{info.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{formatAmount(amount)}</span>
                        <span className="text-xs text-mute ml-2">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-bg2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%`, background: info.color }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Список расходов */}
      {monthExpenses.length > 0 ? (
        <div className="card p-5">
          <h3 className="font-display text-lg font-bold mb-4">Расходы за месяц</h3>
          <div className="space-y-2">
            {monthExpenses
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(expense => {
                const info = EXPENSE_CATEGORIES[expense.category];
                return (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-bg2 hover:bg-raise transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${info.color}20`, color: info.color }}
                    >
                      <Icon name={info.icon as any} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{info.label}</span>
                        {expense.description && (
                          <span className="text-xs text-mute truncate">{expense.description}</span>
                        )}
                      </div>
                      <span className="text-xs text-mute">
                        {new Date(expense.date).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold">{formatAmount(expense.amount)}</span>
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => setEditingExpense(expense)}
                          className="p-1 text-mute hover:text-ink transition-colors"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-1 text-mute hover:text-danger transition-colors"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center text-mute">
          <Icon name="chart" size={48} className="mx-auto mb-3 opacity-30" />
          <p>Нет расходов за этот месяц</p>
          <p className="text-sm mt-1">Добавьте первую запись, чтобы отслеживать расходы</p>
        </div>
      )}

      {/* Модалка добавления */}
      {showForm && (
        <ExpenseFormModal
          onClose={() => setShowForm(false)}
          onSubmit={handleAdd}
        />
      )}

      {/* Модалка редактирования */}
      {editingExpense && (
        <ExpenseFormModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSubmit={(data) => handleUpdate(editingExpense.id, data)}
        />
      )}
    </div>
  );
}

interface ExpenseFormModalProps {
  expense?: Expense;
  onClose: () => void;
  onSubmit: (data: { category: ExpenseCategory; amount: number; date: string; description?: string }) => void;
}

function ExpenseFormModal({ expense, onClose, onSubmit }: ExpenseFormModalProps) {
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category || 'food');
  const [amount, setAmount] = useState(expense?.amount.toString() || '');
  const [date, setDate] = useState(expense?.date || new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(expense?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;

    onSubmit({
      category,
      amount: amt,
      date,
      description: description || undefined,
    });
  };

  return (
    <Modal open onClose={onClose} title={expense ? 'Редактировать расход' : 'Новый расход'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Категория</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(EXPENSE_CATEGORIES).map(([key, info]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key as ExpenseCategory)}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                  category === key
                    ? 'border-accent bg-accent/10'
                    : 'border-line hover:border-mute'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${info.color}20`, color: info.color }}
                >
                  <Icon name={info.icon as any} size={16} />
                </div>
                <span className="text-sm font-medium">{info.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Сумма (₽)">
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            placeholder="1500"
            required
          />
        </Field>

        <Field label="Дата">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            required
          />
        </Field>

        <Field label="Описание (необязательно)">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            placeholder="Например: Royal Canin 2кг"
          />
        </Field>

        <div className="flex gap-2 pt-2">
          <Btn type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Btn>
          <Btn type="submit">
            <Icon name="check" size={16} />
            {expense ? 'Сохранить' : 'Добавить'}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
