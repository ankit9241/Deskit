export type FocusState = 'idle' | 'focus' | 'break' | 'paused';

export interface FocusSession {
  id: string;
  duration_minutes: number;
  break_minutes: number;
  state: FocusState;
  remaining_seconds: number;
  is_running: boolean;
  updated_at: string;
  ends_at?: string | null;
}
