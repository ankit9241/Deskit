import React from 'react';
import { Layers, Sparkles, LayoutGrid, Sliders, Briefcase } from 'lucide-react';

export type ManagerTab = 'my_widgets' | 'library' | 'workspaces' | 'settings';

interface HeaderProps {
  activeTab: ManagerTab;
  onTabChange: (tab: ManagerTab) => void;
  pinnedCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, pinnedCount }) => {
  return (
    <header
      data-tauri-drag-region
      className="flex items-center justify-between px-6 py-4 bg-[#101114]/80 backdrop-blur-xl border-b border-white/[0.06] shrink-0 select-none cursor-move"
    >
      {/* Brand & Tagline */}
      <div data-tauri-drag-region className="flex items-center gap-3 pointer-events-none">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8B9CF6] to-[#64C99A] flex items-center justify-center shadow-[0_0_16px_rgba(139,156,246,0.3)]">
          <Sparkles size={16} className="text-black stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-[#F5F5F7]">PINNED</h1>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/[0.06] text-[#8B9CF6] font-mono">
              v0.2.0
            </span>
          </div>
          <p className="text-[11px] text-[#747985]">Your workspace. Always within reach.</p>
        </div>
      </div>

      {/* Navigation Segmented Control */}
      <nav className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/[0.06] pointer-events-auto">
        <button
          onClick={() => onTabChange('my_widgets')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'my_widgets'
              ? 'bg-white/[0.12] text-[#F5F5F7] shadow-sm'
              : 'text-[#A0A3AD] hover:text-[#F5F5F7] hover:bg-white/[0.04]'
          }`}
        >
          <Layers size={13} />
          <span>My Widgets</span>
          {pinnedCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#8B9CF6] text-black text-[10px] font-bold flex items-center justify-center">
              {pinnedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('library')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'library'
              ? 'bg-white/[0.12] text-[#F5F5F7] shadow-sm'
              : 'text-[#A0A3AD] hover:text-[#F5F5F7] hover:bg-white/[0.04]'
          }`}
        >
          <LayoutGrid size={13} />
          <span>Widget Library</span>
        </button>

        <button
          onClick={() => onTabChange('workspaces')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'workspaces'
              ? 'bg-white/[0.12] text-[#F5F5F7] shadow-sm'
              : 'text-[#A0A3AD] hover:text-[#F5F5F7] hover:bg-white/[0.04]'
          }`}
        >
          <Briefcase size={13} />
          <span>Workspaces</span>
        </button>

        <button
          onClick={() => onTabChange('settings')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'settings'
              ? 'bg-white/[0.12] text-[#F5F5F7] shadow-sm'
              : 'text-[#A0A3AD] hover:text-[#F5F5F7] hover:bg-white/[0.04]'
          }`}
        >
          <Sliders size={13} />
          <span>Settings</span>
        </button>
      </nav>
    </header>
  );
};
