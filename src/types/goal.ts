export interface DailyGoal {
  id: string;
  title: string;
  target_count: number;
  current_count: number;
  is_completed: boolean;
  date_str: string;
  current_streak?: number;
  longest_streak?: number;
  created_at: string;
  updated_at: string;
}

export interface GoalHistoryEntry {
  id: string;
  goal_id: string;
  date_str: string;
  target_count: number;
  current_count: number;
  is_completed: boolean;
  recorded_at: string;
}
