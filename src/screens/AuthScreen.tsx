// Экран авторизации
import { useState } from 'react';
import { useApp } from '../state/AppContext';

export function AuthScreen() {
  const { login, register } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      const success = login(email, password);
      if (!success) {
        setError('Неверный email или пароль');
      }
    } else {
      if (!name.trim()) {
        setError('Введите имя');
        return;
      }
      const success = register(email, password, name);
      if (!success) {
        setError('Пользователь с таким email уже существует');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="card max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🐾</div>
          <h1 className="text-3xl font-bold text-ink mb-2">Лапометр</h1>
          <p className="text-muted">Журнал заботы о питомце</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              mode === 'login'
                ? 'bg-accent text-accent-ink'
                : 'bg-bg2 text-muted hover:bg-raise'
            }`}
          >
            Вход
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              mode === 'register'
                ? 'bg-accent text-accent-ink'
                : 'bg-bg2 text-muted hover:bg-raise'
            }`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="label">Имя</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Ваше имя"
                required
              />
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <label className="label">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
          >
            {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted">
          <p>Демо-доступ:</p>
          <p className="font-mono mt-1">demo@lapometr.app / demo123</p>
        </div>
      </div>
    </div>
  );
}
