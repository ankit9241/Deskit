import { WidgetType, VisibilityMode } from './widget';

export interface WorkspaceWidgetLayout {
  widget_id: string;
  widget_type: WidgetType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_pinned: boolean;
  visibility_mode: VisibilityMode;
  is_collapsed: boolean;
  lock_position: boolean;
  config_json: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  widgets: WorkspaceWidgetLayout[];
  created_at: string;
  updated_at: string;
}
