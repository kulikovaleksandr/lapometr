import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Btn } from './ui';
import { Icon } from './icons';
import {
  assessWeight,
  calculateDewormingDose,
  calculateWeightChange,
  getCurrentWeight,
  prepareWeightChartData,
} from '../lib/weight';
import type { WeightEntry } from '../lib/types';

export function WeightTracker() {
  const { pet, db, addWeight, deleteWeight } = useApp();
  const weights = db.weights;
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  if (!pet) return null;

  const currentWeight = getCurrentWeight(weights, pet.id);
  const weightChange = calculateWeightChange(weights, pet.id);
  const chartData = prepareWeightChartData(weights, pet.id);
  const assessment = currentWeight ? assessWeight(currentWeight.weight, pet.species) : null;
  const dose = currentWeight ? calculateDewormingDose(currentWeight.weight) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) return;

    const error = addWeight({ weight: w, date, note: note || undefined });
    if (!error) {
      setWeight('');
      setNote('');
      setShowForm(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить эту запись?')) {
      deleteWeight(id);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Icon name="chart" size={20} />
          <h3 className="card-title">Вес и замеры</h3>
        </div>
        <Btn variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
          <Icon name={showForm ? 'x' : 'plus'} size={16} />
        </Btn>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card-body border-b border-line">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Вес (кг)</label>
              <input
                type="number"
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="input"
                placeholder="4.5"
                required
              />
            </div>
            <div>
              <label className="label">Дата</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Заметка (необязательно)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input"
                placeholder="Например: после визита к ветеринару"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Btn type="submit" variant="primary">
              <Icon name="check" size={16} />
              Сохранить
            </Btn>
            <Btn type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Отмена
            </Btn>
          </div>
        </form>
      )}

      <div className="card-body">
        {currentWeight ? (
          <>
            {/* Текущий вес и оценка */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="stat-card">
                <div className="stat-label">Текущий вес</div>
                <div className="stat-value">{currentWeight.weight} кг</div>
                <div className="stat-subtitle">
                  {new Date(currentWeight.date).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Изменение</div>
                <div
                  className="stat-value"
                  style={{
                    color:
                      weightChange.trend === 'up'
                        ? '#10b981'
                        : weightChange.trend === 'down'
                          ? '#ef4444'
                          : '#888',
                  }}
                >
                  {weightChange.change > 0 ? '+' : ''}
                  {weightChange.change.toFixed(2)} кг
                </div>
                <div className="stat-subtitle">
                  {weightChange.percentage > 0 ? '+' : ''}
                  {weightChange.percentage.toFixed(1)}%
                </div>
              </div>

              {assessment && (
                <div className="stat-card">
                  <div className="stat-label">Оценка</div>
                  <div className="stat-value" style={{ color: assessment.color }}>
                    {assessment.status === 'normal'
                      ? '✓ Норма'
                      : assessment.status === 'underweight'
                        ? '⚠ Недобор'
                        : '⚠ Избыток'}
                  </div>
                  <div className="stat-subtitle text-xs">{assessment.message}</div>
                </div>
              )}
            </div>

            {/* График веса */}
            {chartData.values.length > 1 && (
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-bold">Динамика веса</h4>
                <div className="h-48">
                  <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
                    {/* Сетка */}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <line
                        key={i}
                        x1="0"
                        y1={i * 50}
                        x2="400"
                        y2={i * 50}
                        stroke="var(--line)"
                        strokeWidth="0.5"
                        strokeDasharray="4 4"
                      />
                    ))}

                    {/* Линия графика */}
                    <polyline
                      points={chartData.values
                        .map((v, i) => {
                          const x = (i / (chartData.values.length - 1)) * 400;
                          const min = Math.min(...chartData.values) * 0.9;
                          const max = Math.max(...chartData.values) * 1.1;
                          const y = 200 - ((v - min) / (max - min)) * 200;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2"
                    />

                    {/* Точки */}
                    {chartData.values.map((v, i) => {
                      const x = (i / (chartData.values.length - 1)) * 400;
                      const min = Math.min(...chartData.values) * 0.9;
                      const max = Math.max(...chartData.values) * 1.1;
                      const y = 200 - ((v - min) / (max - min)) * 200;
                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="var(--accent)"
                          className="cursor-pointer"
                        >
                          <title>
                            {chartData.labels[i]}: {v} кг
                          </title>
                        </circle>
                      );
                    })}
                  </svg>
                </div>
                <div className="mt-2 flex justify-between text-xs text-mute">
                  <span>{chartData.labels[0]}</span>
                  <span>{chartData.labels[chartData.labels.length - 1]}</span>
                </div>
              </div>
            )}

            {/* Расчёт дозировки */}
            {dose && (
              <div className="mt-6 rounded-xl bg-accent-soft p-4">
                <div className="flex items-center gap-2">
                  <Icon name="pill" size={18} className="text-accent" />
                  <h4 className="text-sm font-bold">Расчёт дозировки препарата от глистов</h4>
                </div>
                <div className="mt-2 text-sm">
                  <p>
                    <strong>Доза:</strong> {dose.dose} {dose.unit}
                  </p>
                  <p className="mt-1 text-xs text-mute">{dose.instructions}</p>
                </div>
              </div>
            )}

            {/* История записей */}
            {weights.filter((w) => w.petId === pet.id).length > 0 && (
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-bold">История записей</h4>
                <div className="space-y-2">
                  {weights
                    .filter((w) => w.petId === pet.id)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 10)
                    .map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between rounded-lg bg-bg2 p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{w.weight} кг</span>
                            <span className="text-xs text-mute">
                              {new Date(w.date).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          {w.note && <div className="mt-1 text-xs text-mute">{w.note}</div>}
                        </div>
                        <button
                          onClick={() => handleDelete(w.id)}
                          className="rounded-lg p-1.5 text-mute transition hover:bg-danger/12 hover:text-danger"
                          aria-label="Удалить"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-mute">
            <Icon name="chart" size={48} className="mx-auto mb-3 opacity-30" />
            <p>Нет записей о весе</p>
            <p className="text-sm mt-1">Добавьте первую запись, чтобы отслеживать динамику</p>
          </div>
        )}
      </div>
    </div>
  );
}
