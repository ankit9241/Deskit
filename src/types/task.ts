export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  priority: TaskPriority;
  due_date?: string;
  created_at: string;
  updated_at: string;
}
