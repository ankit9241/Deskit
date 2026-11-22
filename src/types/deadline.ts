export interface Deadline {
  id: string;
  title: string;
  due_date: string;
  category: string;
  is_completed: boolean;
  notify_lead_minutes?: number;
  notified_lead?: boolean;
  notified_due?: boolean;
  created_at: string;
  updated_at: string;
}
