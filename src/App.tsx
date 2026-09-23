import { AppProvider, useApp } from './state/AppContext';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';

function AppContent() {
  const { currentUser, currentPet } = useApp();

  if (!currentUser) {
    return <AuthScreen />;
  }

  if (!currentPet) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '2rem'
      }}>
        <div style={{
          background: 'var(--surface)',
          borderRadius: '0.75rem',
          padding: '2rem',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🐾</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text)' }}>
            Добро пожаловать!
          </h2>
          <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
            Создайте вашего первого питомца, чтобы начать
          </p>
          <button
            onClick={() => {
              const name = prompt('Введите имя питомца:');
              if (name) {
                const species = prompt('Вид питомца (cat/dog/rabbit/parrot/hamster/fish):', 'cat') || 'cat';
                // Используем addPet из контекста через window
                (window as any).__addPet?.(name, species);
              }
            }}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Создать питомца
          </button>
        </div>
      </div>
    );
  }

  return <HomeScreen />;
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
