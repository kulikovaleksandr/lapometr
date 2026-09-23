import { useState } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';

type Screen = 'auth' | 'home';

function AppContent() {
  const { currentUser, currentPet } = useApp();
  const [screen, setScreen] = useState<Screen>(() => {
    if (!currentUser) return 'auth';
    return 'home';
  });

  // Экран авторизации
  if (screen === 'auth' || !currentUser) {
    return <AuthScreen />;
  }

  // Главный экран
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Шапка */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{ color: '#f59e0b', margin: 0, fontSize: '1.5rem' }}>🐾 Лапометр</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--muted)' }}>{currentUser.name}</span>
          <button
            onClick={() => {
              localStorage.removeItem('lapometr.session');
              window.location.reload();
            }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--line)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Выйти
          </button>
        </div>
      </header>

      {/* Контент */}
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <HomeScreen />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
