import { useState, useEffect, useMemo } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import { AuthScreen } from './screens/Auth';
import { OnboardingScreen } from './screens/Onboarding';
import { HomeScreen } from './screens/Home';
import { JournalScreen } from './screens/Journal';
import { DuelScreen } from './screens/Duel';
import { VetScreen } from './screens/Vet';
import { StatsScreen } from './screens/Stats';
import { SettingsScreen } from './screens/Settings';
import { PetForm } from './components/PetForm';
import { AchievementsPanel } from './components/AchievementsPanel';
import { Modal, Btn } from './components/ui';
import { Icon } from './components/icons';
import { PWAInstallButton } from './components/PWAInstallButton';
import { NetworkIndicator } from './components/NetworkIndicator';
import { nextOccurrence, startOfDay } from './lib/db';
import type { Pet } from './lib/types';

type Screen = 'auth' | 'onboarding' | 'home' | 'journal' | 'duel' | 'vet' | 'achievements' | 'stats' | 'settings';

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: number;
}

function NavButton({ active, onClick, icon, label, badge }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.75rem 1rem',
        background: active ? 'var(--accent-soft)' : 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--accent)' : 'var(--ink)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.875rem',
        fontWeight: active ? 600 : 400,
        whiteSpace: 'nowrap',
        position: 'relative',
        transition: 'all 0.2s'
      }}
    >
      <Icon name={icon as any} size={18} />
      {label}
      {badge !== undefined && badge > 0 && (
        <span style={{
          background: 'var(--danger)',
          color: 'white',
          borderRadius: '9999px',
          padding: '0.125rem 0.5rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          marginLeft: '0.25rem'
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function AppContent() {
  const { user, pet, userPets, setActivePet, createPet, events, now } = useApp();
  const [screen, setScreen] = useState<Screen>(() => {
    if (!user) return 'auth';
    if (!pet) return 'onboarding';
    return 'home';
  });
  const [showAddPetModal, setShowAddPetModal] = useState(false);

  // Вычисляем количество событий, требующих внимания
  const dueSoonCount = useMemo(() => {
    if (!events) return 0;
    return events.filter((ev) => startOfDay(nextOccurrence(ev, now)) <= now).length;
  }, [events, now]);

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

      {/* Навигация */}
      <nav style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
        padding: '0 2rem',
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto'
      }}>
        <NavButton 
          active={screen === 'home'} 
          onClick={() => setScreen('home')}
          icon="home"
          label="Главная"
        />
        <NavButton 
          active={screen === 'journal'} 
          onClick={() => setScreen('journal')}
          icon="book"
          label="Журнал"
        />
        <NavButton 
          active={screen === 'duel'} 
          onClick={() => setScreen('duel')}
          icon="trophy"
          label="Дуэль"
        />
        <NavButton 
          active={screen === 'vet'} 
          onClick={() => setScreen('vet')}
          icon="stetho"
          label="Здоровье"
          badge={dueSoonCount > 0 ? dueSoonCount : undefined}
        />
        <NavButton 
          active={screen === 'achievements'} 
          onClick={() => setScreen('achievements')}
          icon="trophy"
          label="Ачивки"
        />
        <NavButton 
          active={screen === 'stats'} 
          onClick={() => setScreen('stats')}
          icon="chart"
          label="Статистика"
        />
        <NavButton 
          active={screen === 'settings'} 
          onClick={() => setScreen('settings')}
          icon="gear"
          label="Настройки"
        />
      </nav>

      {/* Контент */}
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {screen === 'home' && <HomeScreen onNav={setScreen} />}
        {screen === 'journal' && <JournalScreen />}
        {screen === 'duel' && <DuelScreen onCopy={() => {}} />}
        {screen === 'vet' && <VetScreen />}
        {screen === 'achievements' && <AchievementsPanel />}
        {screen === 'stats' && <StatsScreen />}
        {screen === 'settings' && <SettingsScreen onCopy={() => {}} />}
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
