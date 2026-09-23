// Основные типы для приложения Лапометр

export type Species = 'cat' | 'dog' | 'rabbit' | 'parrot' | 'hamster' | 'fish';

export interface User {
  id: string;
  email: string;
  name: string;
  color: string;
  avatar?: string;
  cloudId?: string;
}

export interface Pet {
  id: string;
  name: string;
  species: Species;
  birthday?: string;
  createdAt: number;
  ownerIds: string[];
  seasonSettings?: SeasonSettings;
  monthlyResults?: MonthlyResult[];
}

export interface Activity {
  id: string;
  petId: string;
  title: string;
  paws: number;
  icon: string;
  color: string;
  limitDay?: number;
  limitWeek?: number;
  limitMonth?: number;
  remindH?: number;
}

export interface LogEntry {
  id: string;
  activityId: string;
  userId: string;
  petId: string;
  timestamp: number;
  onBehalfOf?: string;
}

export interface SeasonSettings {
  enabled: boolean;
  resetDay: number;
}

export interface MonthlyResult {
  petId: string;
  month: string; // YYYY-MM
  winnerId: string | null;
  pawsByUser: Record<string, number>;
  activitiesByUser: Record<string, number>;
}

export interface DB {
  users: User[];
  pets: Pet[];
  activities: Activity[];
  logs: LogEntry[];
  seasonSettings: Record<string, SeasonSettings>;
  monthlyResults: MonthlyResult[];
}
