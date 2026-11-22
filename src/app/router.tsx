import React, { useState, useEffect } from 'react';
import { WidgetType } from '@/types/widget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import { ClockWidgetContent } from '@/features/clock/ClockWidget';
import { TasksWidgetContent } from '@/features/tasks/TasksWidget';
import { FocusWidgetContent } from '@/features/focus/FocusWidget';
import { NotesWidgetContent } from '@/features/notes/NotesWidget';
import { DeadlinesWidgetContent } from '@/features/deadlines/DeadlinesWidget';
import { GoalsWidgetContent } from '@/features/goals/GoalsWidget';
import { Sidebar, ManagerTab } from '@/components/manager/Sidebar';
import { MyWidgetsView } from '@/components/manager/MyWidgetsView';
import { WidgetLibraryView } from '@/components/manager/WidgetLibraryView';
import { WorkspacesView } from '@/components/manager/WorkspacesView';
import { SettingsView } from '@/components/manager/SettingsView';
import { FloatingDock } from '@/components/shared/FloatingDock';
import { useWidgetStore } from '@/stores/widgetStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useClockStore } from '@/stores/clockStore';
import { BellIcon } from '@/components/shared/icons';
import { isTauri } from '@/services/tauriApi';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WidgetErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[WidgetErrorBoundary] Caught widget render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4 bg-[#1C1C1E] text-[#F1EFE8] text-center select-none rounded-[20px] border border-white/10">
          <div className="w-6 h-6 rounded-full bg-[#C58D85]/20 text-[#C58D85] flex items-center justify-center mb-2 text-xs font-bold">
            !
          </div>
          <div className="text-[#C58D85] text-xs font-semibold mb-1">Widget Rendering Error</div>
          <div className="text-[10px] text-[#B7B3A9] max-w-[220px] truncate mb-3">
            {this.state.error?.message || 'Unexpected display error'}
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-3 py-1 text-[11px] rounded bg-[#302F2B] hover:bg-[#383732] text-[#F1EFE8] border border-white/10 transition-colors"
          >
            Reload Widget
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------- INDEPENDENT WIDGET WINDOW VIEW ----------------
interface WidgetWindowViewProps {
  widgetId: string;
  widgetType: WidgetType;
}

const WidgetWindowView: React.FC<WidgetWindowViewProps> = ({ widgetId, widgetType }) => {
  const getWidgetComponent = () => {
    switch (widgetType) {
      case 'clock':
        return <ClockWidgetContent />;
      case 'tasks':
        return <TasksWidgetContent />;
      case 'focus':
        return <FocusWidgetContent />;
      case 'notes':
        return <NotesWidgetContent />;
      case 'deadlines':
        return <DeadlinesWidgetContent />;
      case 'goals':
        return <GoalsWidgetContent />;
      default:
        return (
          <div className="p-4 text-xs text-[#C58D85]">
            Unknown widget type: {widgetType}
          </div>
        );
    }
  };

  const getWidgetTitle = () => {
    switch (widgetType) {
      case 'clock':
        return 'Clock';
      case 'tasks':
        return 'Tasks';
      case 'focus':
        return 'Focus Timer';
      case 'notes':
        return 'Quick Notes';
      case 'deadlines':
        return 'Deadlines';
      case 'goals':
        return 'Daily Goals';
      default:
        return 'Widget';
    }
  };

  useEffect(() => {
    document.title = `DESKIT — ${getWidgetTitle()}`;
  }, [widgetType]);

  return (
    <WidgetErrorBoundary>
      <WidgetContainer widgetId={widgetId} widgetType={widgetType} title={getWidgetTitle()}>
        {getWidgetComponent()}
      </WidgetContainer>
    </WidgetErrorBoundary>
  );
};

export const Router: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ManagerTab>('my_widgets');
  const { widgets, fetchWidgets, initListeners: initWidgetListeners } = useWidgetStore();
  const { fetchSettings, initListeners: initSettingsListeners } = useSettingsStore();
  const { ringingAlarm, dismissAlarm, initListeners: initClockListeners } = useClockStore();

  // Multi-tier route resolution - evaluated once and locked in state
  const [widgetRoute] = useState<{ widgetId: string; widgetType: WidgetType } | null>(() => {
    // 1. URL search params
    const searchParams = new URLSearchParams(window.location.search);
    let id = searchParams.get('widget_id') || searchParams.get('widgetId') || searchParams.get('id');
    let type = (searchParams.get('type') || searchParams.get('widget_type') || searchParams.get('widgetType')) as WidgetType | null;

    // 2. Global injection script (Native Tauri)
    const globalWidget = (window as any).__DESKIT_WIDGET__;
    if ((!id || !type) && globalWidget) {
      id = id || globalWidget.id;
      type = type || (globalWidget.type as WidgetType);
    }

    // 3. Tauri window label inspection
    if ((!id || !type) && isTauri()) {
      try {
        const rawLabel = (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label || '';
        if (rawLabel.startsWith('widget-')) {
          const parts = rawLabel.split('-');
          if (parts.length >= 3) {
            type = parts[1] as WidgetType;
            id = parts.slice(2).join('-');
          }
        }
      } catch {}
    }

    // 4. SessionStorage persistence
    if (!id) {
      try { id = sessionStorage.getItem('DESKIT_WIDGET_ID'); } catch {}
    }
    if (!type) {
      try { type = sessionStorage.getItem('DESKIT_WIDGET_TYPE') as WidgetType | null; } catch {}
    }

    // 5. LocalStorage lookup if id is known but type was omitted
    if (id && !type) {
      try {
        const raw = localStorage.getItem('deskit_widgets');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const match = list.find((w: any) => w.id === id);
            if (match && match.widget_type) {
              type = match.widget_type as WidgetType;
            }
          }
        }
      } catch {}
    }

    // 6. Last active widget in sessionStorage
    if (!type && id) {
      try {
        const lastWidget = sessionStorage.getItem('last_deskit_widget');
        if (lastWidget) {
          const parsed = JSON.parse(lastWidget);
          if (parsed && parsed.widget_type) type = parsed.widget_type as WidgetType;
        }
      } catch {}
    }

    // 7. If id is present (e.g. from popup URL), default to focus so popup NEVER loads Manager UI
    if (id && !type) {
      type = 'focus';
    }

    if (id && type) {
      try {
        sessionStorage.setItem('DESKIT_WIDGET_ID', id);
        sessionStorage.setItem('DESKIT_WIDGET_TYPE', type);
      } catch {}
      return { widgetId: id, widgetType: type };
    }

    return null;
  });

  useEffect(() => {
    fetchWidgets().catch(() => {});
    fetchSettings().catch(() => {});
    const unlistenWidgets = initWidgetListeners();
    const unlistenSettings = initSettingsListeners();
    const unlistenClock = initClockListeners();

    return () => {
      unlistenWidgets.then((fn) => fn && fn()).catch(() => {});
      unlistenSettings.then((fn) => fn && fn()).catch(() => {});
      unlistenClock.then((fn) => fn && fn()).catch(() => {});
    };
  }, []);

  // ---------------- INDEPENDENT WIDGET WINDOW ROUTE ----------------
  if (widgetRoute?.widgetId && widgetRoute?.widgetType) {
    return <WidgetWindowView widgetId={widgetRoute.widgetId} widgetType={widgetRoute.widgetType} />;
  }

  // ---------------- MAIN MANAGER APPLICATION ROUTE ----------------
  const pinnedCount = widgets.filter((w) => w.is_pinned).length;

  return (
    <div className="relative flex h-screen w-screen bg-[#1C1C1E] text-[#F1EFE8] select-none overflow-hidden font-sans">
      {/* Compact Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pinnedCount={pinnedCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {activeTab === 'my_widgets' && <MyWidgetsView onGoToLibrary={() => setActiveTab('library')} />}
        {activeTab === 'library' && <WidgetLibraryView />}
        {activeTab === 'workspaces' && <WorkspacesView />}
        {activeTab === 'settings' && <SettingsView />}
      </div>

      {/* Floating Manager Dock */}
      <FloatingDock />

      {/* Ringing Alarm Global Banner */}
      {ringingAlarm && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600/90 border border-red-400 rounded-xl shadow-2xl flex items-center gap-3 animate-pulse">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
            <BellIcon size={14} className="animate-bounce" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-red-200">Alarm Ringing</div>
            <div className="text-sm font-semibold text-white font-tabular">{ringingAlarm.time_str} - {ringingAlarm.title}</div>
          </div>
          <button
            onClick={() => dismissAlarm(ringingAlarm.id)}
            className="ml-3 px-3 py-1 bg-white text-red-700 hover:bg-red-50 font-bold text-xs rounded-lg shadow transition-all cursor-pointer shrink-0"
          >
            DISMISS
          </button>
        </div>
      )}
    </div>
  );
};
