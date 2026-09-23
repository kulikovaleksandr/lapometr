// Главный экран приложения
import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';

export function HomeScreen() {
  const { db, currentUser, currentPet, logActivity, addPet } = useApp();
  const [showPetForm, setShowPetForm] = useState(false);
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState<'cat' | 'dog' | 'rabbit' | 'parrot' | 'hamster' | 'fish'>('cat');
  const [petBirthday, setPetBirthday] = useState('');

  if (!currentUser) {
    return null;
  }

  if (!currentPet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="card max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🐾</div>
            <h2 className="text-2xl font-bold text-ink mb-2">Добро пожаловать!</h2>
            <p className="text-muted">Создайте питомца, чтобы начать</p>
          </div>

          {!showPetForm ? (
            <button
              onClick={() => setShowPetForm(true)}
              className="btn btn-primary w-full"
            >
              <Icon name="plus" size={20} />
              Создать питомца
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (petName.trim()) {
                  addPet(petName, petSpecies, petBirthday || undefined);
                  setShowPetForm(false);
                  setPetName('');
                  setPetSpecies('cat');
                  setPetBirthday('');
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="label">Кличка питомца</label>
                <input
                  type="text"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  className="input"
                  placeholder="Например, Барсик"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Вид питомца</label>
                <select
                  value={petSpecies}
                  onChange={(e) => setPetSpecies(e.target.value as typeof petSpecies)}
                  className="input"
                >
                  <option value="cat">🐱 Кошка</option>
                  <option value="dog">🐶 Собака</option>
                  <option value="rabbit">🐰 Кролик</option>
                  <option value="parrot">🦜 Попугай</option>
                  <option value="hamster">🐹 Хомяк</option>
                  <option value="fish">🐠 Рыбка</option>
                </select>
              </div>

              <div>
                <label className="label">Дата рождения (необязательно)</label>
                <input
                  type="date"
                  value={petBirthday}
                  onChange={(e) => setPetBirthday(e.target.value)}
                  className="input"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPetForm(false);
                    setPetName('');
                    setPetSpecies('cat');
                    setPetBirthday('');
                  }}
                  className="btn btn-ghost flex-1"
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Создать
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  const petActivities = db.activities.filter(a => a.petId === currentPet.id);
  const petLogs = db.logs.filter(l => l.petId === currentPet.id);
  const totalPaws = petLogs.reduce((sum, log) => {
    const activity = db.activities.find(a => a.id === log.activityId);
    return sum + (activity?.paws || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-bg p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Заголовок */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ink mb-1">
                Привет, {currentUser.name}! 👋
              </h1>
              <p className="text-muted">
                Питомец: <span className="font-semibold text-ink">{currentPet.name}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-accent">{totalPaws}</div>
              <div className="text-sm text-muted">лапок</div>
            </div>
          </div>
        </div>

        {/* Быстрые действия */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
            <Icon name="spark" size={24} />
            Быстрые действия
          </h2>
          {petActivities.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <p>Нет активностей. Создайте первую!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {petActivities.map(activity => (
                <button
                  key={activity.id}
                  onClick={() => logActivity(activity.id)}
                  className="card p-4 hover:bg-raise transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${activity.color}20` }}
                    >
                      <Icon name={activity.icon as any} size={24} />
                    </div>
                    <div>
                      <div className="font-semibold text-ink">{activity.title}</div>
                      <div className="text-sm text-muted">+{activity.paws} лапок</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Последние записи */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
            <Icon name="book" size={24} />
            Последние записи
          </h2>
          {petLogs.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <p>Нет записей. Отметьте первую активность!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {petLogs.slice(-5).reverse().map(log => {
                const activity = db.activities.find(a => a.id === log.activityId);
                const user = db.users.find(u => u.id === log.userId);
                return (
                  <div key={log.id} className="flex items-center gap-3 p-3 bg-bg2 rounded-lg">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${activity?.color || '#f59e0b'}20` }}
                    >
                      <Icon name={activity?.icon as any || 'paw'} size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-ink">{activity?.title}</div>
                      <div className="text-sm text-muted">
                        {user?.name} • {new Date(log.timestamp).toLocaleString('ru-RU')}
                      </div>
                    </div>
                    <div className="text-accent font-bold">+{activity?.paws}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
