export interface WorldClock {
  id: string;
  city_name: string;
  timezone: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Alarm {
  id: string;
  title: string;
  time_str: string; // "HH:MM"
  days_of_week: number[]; // 1 = Monday .. 7 = Sunday
  is_enabled: boolean;
  is_recurring: boolean;
  one_time_date?: string | null;
  last_triggered_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RingingAlarm {
  id: string;
  title: string;
  time_str: string;
}
