export type Species = "cat" | "dog" | "rabbit" | "parrot" | "hamster" | "fish";

export interface User {
  id: string;
  email: string;
  name: string;
  color: string;
  avatar?: string;
}

export interface Pet {
  id: string;
  name: string;
  species: Species;
  birthday?: string;
  createdAt: number;
  ownerIds: string[];
}

export interface Activity {
  id: string;
  petId: string;
  title: string;
  paws: number;
}

export interface LogEntry {
  id: string;
  activityId: string;
  userId: string;
  petId: string;
  timestamp: number;
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
  finalizedAt?: number;
  note?: string; // пометка для краевых случаев
}

export interface DB {
  users: User[];
  pets: Pet[];
  activities: Activity[];
  logs: LogEntry[];
  seasonSettings: Record<string, SeasonSettings>; // petId -> settings
  monthlyResults: MonthlyResult[];
}
