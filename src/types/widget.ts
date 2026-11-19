export type WidgetType = 'clock' | 'tasks' | 'focus' | 'notes' | 'deadlines' | 'goals';

export type VisibilityMode = 'always_on_top' | 'desktop_only' | 'smart';

export interface WidgetInstance {
  id: string;
  widget_type: WidgetType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_pinned: boolean;
  visibility_mode: VisibilityMode;
  is_collapsed: boolean;
  config_json: string;
  created_at: string;
  updated_at: string;
}

export interface WidgetMetadata {
  type: WidgetType;
  name: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  iconName: string;
}
