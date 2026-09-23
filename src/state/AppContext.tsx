// Контекст приложения для управления состоянием
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { DB, User, Pet, Activity, LogEntry } from '../lib/types';
import { loadDB, saveDB, loadSession, saveSession, generateId } from '../lib/storage';

interface AppContextType {
  db: DB;
  currentUser: User | null;
  currentPet: Pet | null;
  setCurrentPet: (petId: string) => void;
  login: (email: string, password: string) => boolean;
  register: (email: string, password: string, name: string) => boolean;
  logout: () => void;
  addPet: (name: string, species: string, birthday?: string) => void;
  addActivity: (petId: string, title: string, paws: number) => void;
  logActivity: (activityId: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB());
  const [currentUserId, setCurrentUserId] = useState<string | null>(loadSession());
  const [currentPetId, setCurrentPetId] = useState<string | null>(null);

  // Сохраняем БД при изменениях
  useEffect(() => {
    saveDB(db);
  }, [db]);

  // Устанавливаем первого питомца, если есть
  useEffect(() => {
    if (!currentPetId && db.pets.length > 0) {
      setCurrentPetId(db.pets[0].id);
    }
  }, [db.pets, currentPetId]);

  const currentUser = currentUserId ? db.users.find(u => u.id === currentUserId) || null : null;
  const currentPet = currentPetId ? db.pets.find(p => p.id === currentPetId) || null : null;

  const login = (email: string, password: string): boolean => {
    const user = db.users.find(u => u.email === email);
    if (user) {
      setCurrentUserId(user.id);
      saveSession(user.id);
      return true;
    }
    return false;
  };

  const register = (email: string, password: string, name: string): boolean => {
    if (db.users.find(u => u.email === email)) {
      return false;
    }
    const newUser: User = {
      id: generateId(),
      email,
      name,
      color: '#f59e0b',
    };
    setDb({ ...db, users: [...db.users, newUser] });
    setCurrentUserId(newUser.id);
    saveSession(newUser.id);
    return true;
  };

  const logout = () => {
    setCurrentUserId(null);
    saveSession(null);
  };

  const setCurrentPet = (petId: string) => {
    setCurrentPetId(petId);
  };

  const addPet = (name: string, species: string, birthday?: string) => {
    if (!currentUser) return;
    const newPet: Pet = {
      id: generateId(),
      name,
      species: species as any,
      birthday,
      createdAt: Date.now(),
      ownerIds: [currentUser.id],
    };
    setDb({ ...db, pets: [...db.pets, newPet] });
    setCurrentPetId(newPet.id);
  };

  const addActivity = (petId: string, title: string, paws: number) => {
    const newActivity: Activity = {
      id: generateId(),
      petId,
      title,
      paws,
      icon: 'paw',
      color: '#f59e0b',
    };
    setDb({ ...db, activities: [...db.activities, newActivity] });
  };

  const logActivity = (activityId: string) => {
    if (!currentUser || !currentPet) return;
    const newLog: LogEntry = {
      id: generateId(),
      activityId,
      userId: currentUser.id,
      petId: currentPet.id,
      timestamp: Date.now(),
    };
    setDb({ ...db, logs: [...db.logs, newLog] });
  };

  return (
    <AppContext.Provider
      value={{
        db,
        currentUser,
        currentPet,
        setCurrentPet,
        login,
        register,
        logout,
        addPet,
        addActivity,
        logActivity,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
