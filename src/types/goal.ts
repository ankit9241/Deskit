export interface DailyGoal {
  id: string;
  title: string;
  target_count: number;
  current_count: number;
  is_completed: boolean;
  date_str: string;
  created_at: string;
  updated_at: string;
}
