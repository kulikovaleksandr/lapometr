import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import { AuthScreen } from './screens/Auth';
import { OnboardingScreen } from './screens/Onboarding';
import { HomeScreen } from './screens/Home';
import { PetForm } from './components/PetForm';
import { Modal, Btn } from './components/ui';
import { Icon } from './components/icons';
import { PWAInstallButton } from './components/PWAInstallButton';
import { NetworkIndicator } from './components/NetworkIndicator';
import type { Pet } from './lib/types';

type Screen = 'auth' | 'onboarding' | 'home';

function AppContent() {
  const { user, pet, userPets, setActivePet, createPet } = useApp();
  const [screen, setScreen] = useState<Screen>(() => {
    if (!user) return 'auth';
    if (!pet) return 'onboarding';
    return 'home';
  });
  const [showAddPetModal, setShowAddPetModal] = useState(false);

  // Определяем экран при изменении состояния
  useEffect(() => {
    if (!user) {
      setScreen('auth');
    } else if (!pet) {
      setScreen('onboarding');
    } else if (screen === 'auth' || screen === 'onboarding') {
      setScreen('home');
    }
  }, [user, pet, screen]);

  const handleCreatePet = (data: { name: string; species: any; breed: string; birthday: string; color: string; img?: string }) => {
    createPet(data);
    setShowAddPetModal(false);
  };

  // Экран авторизации
  if (screen === 'auth') {
    return <AuthScreen />;
  }

  // Экран онбординга
  if (screen === 'onboarding') {
    return <OnboardingScreen />;
  }

  // Главный экран с переключателем питомцев
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
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ color: '#f59e0b', margin: 0, fontSize: '1.5rem' }}>🐾 Лапометр</h1>
          
          {/* Переключатель питомцев */}
          {userPets.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={pet?.id || ''}
                onChange={(e) => setActivePet(e.target.value)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--line)',
                  background: 'var(--surface2)',
                  color: 'var(--ink)',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                {userPets.map((p: Pet) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.species === 'cat' ? '🐱' : p.species === 'dog' ? '🐶' : '🐾'})
                  </option>
                ))}
              </select>
              
              {/* Кнопка добавить питомца */}
              <Btn variant="soft" size="sm" onClick={() => setShowAddPetModal(true)}>
                <Icon name="plus" size={16} />
                Добавить
              </Btn>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <NetworkIndicator />
          <PWAInstallButton />
        </div>
      </header>

      {/* Контент */}
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <HomeScreen onNav={() => {}} />
      </main>

      {/* Модалка добавления питомца */}
      <Modal open={showAddPetModal} onClose={() => setShowAddPetModal(false)} title="Новый питомец">
        <div style={{ padding: '1rem' }}>
          <PetForm
            onSubmit={handleCreatePet}
            onCancel={() => setShowAddPetModal(false)}
            submitLabel="Добавить питомца"
          />
        </div>
      </Modal>
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
