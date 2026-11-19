import React from 'react';
import { isTauri } from '@/services/tauriApi';
import {
  DeskitLogo,
  MyWidgetsNavIcon,
  LibraryNavIcon,
  WorkspacesNavIcon,
  SettingsNavIcon,
} from '@/components/shared/icons';

export type ManagerTab = 'my_widgets' | 'library' | 'workspaces' | 'settings';

interface SidebarProps {
  activeTab: ManagerTab;
  onTabChange: (tab: ManagerTab) => void;
  pinnedCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, pinnedCount }) => {
  const navItems = [
    {
      id: 'my_widgets' as ManagerTab,
      label: 'My Widgets',
      icon: <MyWidgetsNavIcon size={16} />,
      badge: pinnedCount > 0 ? pinnedCount : null,
    },
    {
      id: 'library' as ManagerTab,
      label: 'Widget Library',
      icon: <LibraryNavIcon size={16} />,
    },
    {
      id: 'workspaces' as ManagerTab,
      label: 'Workspaces',
      icon: <WorkspacesNavIcon size={16} />,
    },
    {
      id: 'settings' as ManagerTab,
      label: 'Settings',
      icon: <SettingsNavIcon size={16} />,
    },
  ];

  return (
    <aside
      data-tauri-drag-region
      className="w-56 h-full bg-[#1C1B18] border-r border-white/[0.06] flex flex-col justify-between p-3 select-none shrink-0"
    >
      <div>
        {/* Brand identity */}
        <div data-tauri-drag-region className="flex items-center gap-2.5 px-2 py-3 mb-4 cursor-move">
          <DeskitLogo size={20} className="text-[#C5B89D]" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold tracking-tight text-[#F1EFE8]">DESKIT</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.05] text-[#858178] font-mono">
                v1.0
              </span>
            </div>
            <p className="text-[10px] text-[#858178] leading-tight">Desktop Productivity</p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-sidebar text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#302F2B] text-[#F1EFE8] shadow-sm'
                    : 'text-[#B7B3A9] hover:text-[#F1EFE8] hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-[#C5B89D]' : 'text-[#858178]'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>

                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold ${
                      isActive
                        ? 'bg-[#C5B89D] text-[#242421]'
                        : 'bg-white/[0.06] text-[#B7B3A9]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer subtle indicator */}
      <div className="px-2 py-2 border-t border-white/[0.04] text-[10px] text-[#858178]">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isTauri() ? 'bg-[#9DAE9B]' : 'bg-[#C9A77D]'}`} />
          <span className="truncate">
            {isTauri() ? 'Native Win32 Layer Active' : 'Web Preview (Run deskit.exe for Native Layer)'}
          </span>
        </div>
      </div>
    </aside>
  );
};
