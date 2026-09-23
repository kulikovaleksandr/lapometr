import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { DB, User, Pet, Activity, LogEntry, ChatMessage, VetEvent, WeightEntry, Expense, SeasonSettings, MonthlyResult } from '../lib/types';
import { loadDB, saveDB, loadSession, saveSession, generateId } from '../lib/storage';

interface AppContextType {
  db: DB;
  user: User | null;
  pet: Pet | null;
  users: User[];
  pets: Pet[];
  userPets: Pet[];
  owners: User[];
  acts: Activity[];
  logs: LogEntry[];
  chat: ChatMessage[];
  events: VetEvent[];
  weights: WeightEntry[];
  expenses: Expense[];
  monthlyResults: MonthlyResult[];
  currentUser: User | null;
  currentPet: Pet | null;
  now: number;
  theme: string;
  notifOn: boolean;
  cloudUser: any;
  rtStatus: string;
  outboxN: number;
  seasonInfo: any;
  seasonPawsByUser: Record<string, number>;
  seasonActivitiesByUser: Record<string, number>;
  seasonLogs: LogEntry[];
  seasonWinner: any;
  yearlyChampion: string | null;
  setCurrentPet: (petId: string) => void;
  setActivePet: (petId: string) => void;
  login: (email: string, password: string) => boolean;
  register: (email: string, password: string, name: string) => boolean;
  loginDemo: () => void;
  guest: () => void;
  logout: () => void;
  addPet: (name: string, species: string, birthday?: string) => void;
  createPet: (data: any) => void;
  addActivity: (petId: string, title: string, paws: number) => void;
  addAct: (data: any) => string | null;
  updateAct: (id: string, patch: Partial<Activity>) => void;
  deleteAct: (id: string) => void;
  logActivity: (activityId: string) => void;
  complete: (actId: string, img?: string, onBehalfOf?: string) => void;
  sendMessage: (text: string) => void;
  addEvent: (data: any) => string | null;
  updateEvent: (id: string, patch: Partial<VetEvent>) => void;
  deleteEvent: (id: string) => void;
  regenerateVetSchedule: () => void;
  addWeight: (data: any) => string | null;
  updateWeight: (id: string, patch: Partial<WeightEntry>) => void;
  deleteWeight: (id: string) => void;
  addExpense: (data: any) => string | null;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  updateProfile: (patch: Partial<User>) => void;
  regenInvite: () => void;
  joinPet: (code: string) => string | null;
  removeOwner: (ownerId: string) => void;
  setTheme: (theme: string) => void;
  toggleNotif: () => void;
  toast: (message: string, type?: string) => void;
  exportData: () => void;
  resetAll: () => void;
  replaceDb: (db: DB) => void;
  setTg: (patch: any) => void;
  getUserRole: (userId: string) => string;
  setUserRole: (userId: string, role: string) => void;
  canEditActivities: () => boolean;
  updateSeasonSettings: (patch: Partial<SeasonSettings>) => void;
  finalizeCurrentMonth: () => void;
  syncFromCloud: () => Promise<string | null>;
  fetchDivergence: () => Promise<any>;
  applyMerge: () => Promise<void>;
  flushOutboxNow: () => Promise<number>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB());
  const [currentUserId, setCurrentUserId] = useState<string | null>(loadSession());
  const [currentPetId, setCurrentPetId] = useState<string | null>(null);
  const [now] = useState(Date.now());
  const [theme, setThemeState] = useState('night');
  const [notifOn, setNotifOn] = useState(false);

  useEffect(() => { saveDB(db); }, [db]);
  useEffect(() => {
    if (!currentPetId && db.pets.length > 0) setCurrentPetId(db.pets[0].id);
  }, [db.pets, currentPetId]);

  const user = currentUserId ? db.users.find(u => u.id === currentUserId) || null : null;
  const pet = currentPetId ? db.pets.find(p => p.id === currentPetId) || null : null;
  const users = db.users;
  const pets = db.pets;
  const userPets = db.pets.filter(p => user && p.ownerIds.includes(user.id));
  const owners = pet ? db.users.filter(u => pet.ownerIds.includes(u.id)) : [];
  const acts = db.activities;
  const logs = db.logs;
  const chat = db.chat || [];
  const events = db.events || [];
  const weights = db.weights || [];
  const expenses = db.expenses || [];
  const monthlyResults = db.monthlyResults || [];

  const login = (email: string, password: string): boolean => {
    const foundUser = db.users.find(u => u.email === email);
    if (foundUser) { setCurrentUserId(foundUser.id); saveSession(foundUser.id); return true; }
    return false;
  };

  const register = (email: string, password: string, name: string): boolean => {
    if (db.users.find(u => u.email === email)) return false;
    const newUser: User = { id: generateId(), email, name, color: '#f59e0b', createdAt: Date.now() };
    setDb({ ...db, users: [...db.users, newUser] });
    setCurrentUserId(newUser.id);
    saveSession(newUser.id);
    return true;
  };

  const loginDemo = () => {
    const demoUser: User = { id: 'demo-user', email: 'demo@lapometr.app', name: 'Демо Пользователь', color: '#f59e0b', createdAt: Date.now() };
    setDb({ ...db, users: [...db.users, demoUser] });
    setCurrentUserId(demoUser.id);
    saveSession(demoUser.id);
  };

  const guest = () => {
    const guestUser: User = { id: 'guest-' + generateId(), email: 'guest@local', name: 'Гость', color: '#10b981', createdAt: Date.now() };
    setDb({ ...db, users: [...db.users, guestUser] });
    setCurrentUserId(guestUser.id);
    saveSession(guestUser.id);
  };

  const logout = () => { setCurrentUserId(null); saveSession(null); };
  const setCurrentPet = (petId: string) => setCurrentPetId(petId);
  const setActivePet = (petId: string) => setCurrentPetId(petId);

  const addPet = (name: string, species: string, birthday?: string) => {
    if (!user) return;
    const newPet: Pet = { id: generateId(), name, species: species as any, birthday, createdAt: Date.now(), ownerIds: [user.id], breed: '', color: '#f59e0b', invite: generateId() };
    setDb({ ...db, pets: [...db.pets, newPet] });
    setCurrentPetId(newPet.id);
  };

  const createPet = (data: any) => addPet(data.name, data.species, data.birthday);

  const addActivity = (petId: string, title: string, paws: number) => {
    const newActivity: Activity = { id: generateId(), petId, title, paws, icon: 'paw', color: '#f59e0b' };
    setDb({ ...db, activities: [...db.activities, newActivity] });
  };

  const addAct = (data: any): string | null => { addActivity(data.petId, data.title, data.paws); return null; };
  const updateAct = (id: string, patch: Partial<Activity>) => setDb({ ...db, activities: db.activities.map(a => a.id === id ? { ...a, ...patch } : a) });
  const deleteAct = (id: string) => setDb({ ...db, activities: db.activities.filter(a => a.id !== id) });

  const logActivity = (activityId: string) => {
    if (!user || !pet) return;
    const newLog: LogEntry = { id: generateId(), activityId, actId: activityId, userId: user.id, ownerId: user.id, petId: pet.id, timestamp: Date.now(), at: Date.now() };
    setDb({ ...db, logs: [...db.logs, newLog] });
  };

  const complete = (actId: string, img?: string, onBehalfOf?: string) => logActivity(actId);

  const sendMessage = (text: string) => {
    if (!user || !pet) return;
    const newMessage: ChatMessage = { id: generateId(), petId: pet.id, authorId: user.id, text, at: Date.now() };
    setDb({ ...db, chat: [...(db.chat || []), newMessage] });
  };

  const addEvent = (data: any): string | null => {
    if (!pet) return 'Нет питомца';
    const newEvent: VetEvent = { id: generateId(), petId: pet.id, kind: data.kind, title: data.title, date: data.date, time: data.time, repeat: data.repeat, note: data.note };
    setDb({ ...db, events: [...(db.events || []), newEvent] });
    return null;
  };

  const updateEvent = (id: string, patch: Partial<VetEvent>) => setDb({ ...db, events: (db.events || []).map(e => e.id === id ? { ...e, ...patch } : e) });
  const deleteEvent = (id: string) => setDb({ ...db, events: (db.events || []).filter(e => e.id !== id) });
  const regenerateVetSchedule = () => {};

  const addWeight = (data: any): string | null => {
    if (!pet) return 'Нет питомца';
    const newWeight: WeightEntry = { id: generateId(), petId: pet.id, weight: data.weight, date: data.date, note: data.note };
    setDb({ ...db, weights: [...(db.weights || []), newWeight] });
    return null;
  };

  const updateWeight = (id: string, patch: Partial<WeightEntry>) => setDb({ ...db, weights: (db.weights || []).map(w => w.id === id ? { ...w, ...patch } : w) });
  const deleteWeight = (id: string) => setDb({ ...db, weights: (db.weights || []).filter(w => w.id !== id) });

  const addExpense = (data: any): string | null => {
    if (!pet) return 'Нет питомца';
    const newExpense: Expense = { id: generateId(), petId: pet.id, category: data.category, amount: data.amount, date: data.date, description: data.description, createdAt: Date.now() };
    setDb({ ...db, expenses: [...(db.expenses || []), newExpense] });
    return null;
  };

  const updateExpense = (id: string, patch: Partial<Expense>) => setDb({ ...db, expenses: (db.expenses || []).map(e => e.id === id ? { ...e, ...patch } : e) });
  const deleteExpense = (id: string) => setDb({ ...db, expenses: (db.expenses || []).filter(e => e.id !== id) });

  const updateProfile = (patch: Partial<User>) => {
    if (!user) return;
    setDb({ ...db, users: db.users.map(u => u.id === user.id ? { ...u, ...patch } : u) });
  };

  const regenInvite = () => {};
  const joinPet = (code: string): string | null => null;
  const removeOwner = (ownerId: string) => {
    if (!pet) return;
    setDb({ ...db, pets: db.pets.map(p => p.id === pet.id ? { ...p, ownerIds: p.ownerIds.filter(id => id !== ownerId) } : p) });
  };

  const setTheme = (newTheme: string) => { setThemeState(newTheme); localStorage.setItem('lapometr.theme', newTheme); };
  const toggleNotif = () => setNotifOn(!notifOn);
  const toast = (message: string, type: string = 'info') => console.log(`[${type}] ${message}`);

  const exportData = () => {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lapometr-backup.json';
    a.click();
  };

  const resetAll = () => {
    localStorage.removeItem('lapometr.db');
    localStorage.removeItem('lapometr.session');
    window.location.reload();
  };

  const replaceDb = (newDb: DB) => setDb(newDb);
  const setTg = (patch: any) => {};
  const getUserRole = (userId: string) => 'owner';
  const setUserRole = (userId: string, role: string) => {};
  const canEditActivities = () => true;
  const updateSeasonSettings = (patch: Partial<SeasonSettings>) => {};
  const finalizeCurrentMonth = () => {};
  const syncFromCloud = async () => null;
  const fetchDivergence = async () => null;
  const applyMerge = async () => {};
  const flushOutboxNow = async () => 0;

  const value: AppContextType = {
    db, user, pet, users, pets, userPets, owners, acts, logs, chat, events, weights, expenses, monthlyResults,
    currentUser: user, currentPet: pet, now, theme, notifOn, cloudUser: null, rtStatus: 'offline', outboxN: 0,
    seasonInfo: null, seasonPawsByUser: {}, seasonActivitiesByUser: {}, seasonLogs: [], seasonWinner: null, yearlyChampion: null,
    setCurrentPet, setActivePet, login, register, loginDemo, guest, logout, addPet, createPet, addActivity, addAct, updateAct, deleteAct,
    logActivity, complete, sendMessage, addEvent, updateEvent, deleteEvent, regenerateVetSchedule, addWeight, updateWeight, deleteWeight,
    addExpense, updateExpense, deleteExpense, updateProfile, regenInvite, joinPet, removeOwner, setTheme, toggleNotif, toast,
    exportData, resetAll, replaceDb, setTg, getUserRole, setUserRole, canEditActivities, updateSeasonSettings, finalizeCurrentMonth,
    syncFromCloud, fetchDivergence, applyMerge, flushOutboxNow,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
