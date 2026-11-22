import { VisibilityMode } from './widget';

export interface AppSettings {
  launch_at_login: boolean;
  close_to_tray: boolean;
  time_format_24h: boolean;
  show_seconds: boolean;
  default_visibility_mode: VisibilityMode;
  theme: string;
}
