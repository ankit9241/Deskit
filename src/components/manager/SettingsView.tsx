import React, { useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { VisibilityMode } from '@/types/widget';
import { CheckIcon } from '@/components/shared/icons';

export const SettingsView: React.FC = () => {
  const { settings, toggleAutostart, toggleCloseToTray, updateSettings } = useSettingsStore();
  const {
    opacity,
    setOpacity,
    blur,
    setBlur,
    density,
    setDensity,
    reducedMotion,
    setReducedMotion,
    lockPosition,
    setLockPosition,
    snapToEdges,
    setSnapToEdges,
    autoCollapse,
    setAutoCollapse,
    collapseDelaySeconds,
    setCollapseDelaySeconds,
  } = useAppearanceStore();

  const [activeSection, setActiveSection] = useState<'general' | 'appearance' | 'behaviour'>('general');

  const handleDefaultVisibilityChange = async (mode: VisibilityMode) => {
    await updateSettings({ default_visibility_mode: mode });
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-3 border-b border-white/[0.06]">
        <h2 className="text-base font-semibold tracking-tight text-[#F1EFE8]">Settings</h2>
        <p className="text-xs text-[#858178]">
          Configure desktop window behaviour, warm graphite materials, and Dynamic Island collapse.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-0.5 rounded-sidebar bg-[#1C1B18] w-fit">
        <button
          onClick={() => setActiveSection('general')}
          className={`px-3 py-1.5 rounded-sidebar text-xs font-medium transition-all ${
            activeSection === 'general'
              ? 'bg-[#302F2B] text-[#F1EFE8]'
              : 'text-[#858178] hover:text-[#B7B3A9]'
          }`}
        >
          General
        </button>

        <button
          onClick={() => setActiveSection('appearance')}
          className={`px-3 py-1.5 rounded-sidebar text-xs font-medium transition-all ${
            activeSection === 'appearance'
              ? 'bg-[#302F2B] text-[#F1EFE8]'
              : 'text-[#858178] hover:text-[#B7B3A9]'
          }`}
        >
          Appearance & Glass
        </button>

        <button
          onClick={() => setActiveSection('behaviour')}
          className={`px-3 py-1.5 rounded-sidebar text-xs font-medium transition-all ${
            activeSection === 'behaviour'
              ? 'bg-[#302F2B] text-[#F1EFE8]'
              : 'text-[#858178] hover:text-[#B7B3A9]'
          }`}
        >
          Dynamic Island & Behaviour
        </button>
      </div>

      {/* 1. GENERAL SETTINGS */}
      {activeSection === 'general' && (
        <div className="space-y-3">
          {/* Autostart (Default OFF) */}
          <div className="flex items-center justify-between p-3.5 rounded-manager manager-card">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#F1EFE8]">Launch at Windows Login</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.05] text-[#858178] font-mono">
                  Default: OFF
                </span>
              </div>
              <p className="text-[11px] text-[#858178]">
                Starts PINNED automatically when you log in to Windows.
              </p>
            </div>
            <button
              onClick={toggleAutostart}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                settings.launch_at_login ? 'bg-[#C5B89D]' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[#242421] transition-transform ${
                  settings.launch_at_login ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Close to Tray */}
          <div className="flex items-center justify-between p-3.5 rounded-manager manager-card">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-[#F1EFE8]">Close to System Tray</span>
              <p className="text-[11px] text-[#858178]">
                Keeps floating desktop widgets active when manager window is closed.
              </p>
            </div>
            <button
              onClick={toggleCloseToTray}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                settings.close_to_tray ? 'bg-[#C5B89D]' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[#242421] transition-transform ${
                  settings.close_to_tray ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 12/24 Hour format */}
          <div className="flex items-center justify-between p-3.5 rounded-manager manager-card">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-[#F1EFE8]">24-Hour Military Time</span>
              <p className="text-[11px] text-[#858178]">
                Use 24-hour time format across clock and timer widgets.
              </p>
            </div>
            <button
              onClick={() => updateSettings({ time_format_24h: !settings.time_format_24h })}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                settings.time_format_24h ? 'bg-[#C5B89D]' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[#242421] transition-transform ${
                  settings.time_format_24h ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* 2. APPEARANCE & GLASS */}
      {activeSection === 'appearance' && (
        <div className="space-y-3">
          {/* Opacity Slider */}
          <div className="p-3.5 rounded-manager manager-card space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#F1EFE8]">Graphite Surface Opacity</span>
                <p className="text-[11px] text-[#858178]">
                  Controls translucency level of floating widget backgrounds.
                </p>
              </div>
              <span className="text-xs font-mono font-medium text-[#C5B89D]">
                {Math.round(opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.40"
              max="0.95"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full accent-[#C5B89D] cursor-pointer"
            />
          </div>

          {/* Blur Intensity Slider */}
          <div className="p-3.5 rounded-manager manager-card space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#F1EFE8]">Frosted Blur Intensity</span>
                <p className="text-[11px] text-[#858178]">
                  Adjusts the backdrop blur radius applied behind widget surfaces.
                </p>
              </div>
              <span className="text-xs font-mono font-medium text-[#C5B89D]">{blur}px</span>
            </div>
            <input
              type="range"
              min="8"
              max="44"
              step="4"
              value={blur}
              onChange={(e) => setBlur(parseInt(e.target.value))}
              className="w-full accent-[#C5B89D] cursor-pointer"
            />
          </div>

          {/* Component Density */}
          <div className="flex items-center justify-between p-3.5 rounded-manager manager-card">
            <div>
              <span className="text-xs font-medium text-[#F1EFE8]">Widget Content Density</span>
              <p className="text-[11px] text-[#858178]">Adjust internal padding and control spacing.</p>
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-sidebar bg-[#1C1B18] text-xs">
              {(['compact', 'normal', 'comfortable'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={`px-2.5 py-1 rounded capitalize transition-all ${
                    density === d
                      ? 'bg-[#302F2B] text-[#F1EFE8] font-medium'
                      : 'text-[#858178] hover:text-[#B7B3A9]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Reduced Motion Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-manager manager-card">
            <div>
              <span className="text-xs font-medium text-[#F1EFE8]">Reduced Motion</span>
              <p className="text-[11px] text-[#858178]">
                Disables spring physics and morph animations for instant transitions.
              </p>
            </div>
            <button
              onClick={() => setReducedMotion(!reducedMotion)}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                reducedMotion ? 'bg-[#C5B89D]' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[#242421] transition-transform ${
                  reducedMotion ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* 3. DYNAMIC ISLAND & BEHAVIOUR */}
      {activeSection === 'behaviour' && (
        <div className="space-y-3">
          {/* Dynamic Island Auto-collapse */}
          <div className="flex items-center justify-between p-3.5 rounded-manager manager-card">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#F1EFE8]">Dynamic Island Auto-Collapse</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#C5B89D]/15 text-[#C5B89D] font-mono">
                  Core Feature
                </span>
              </div>
              <p className="text-[11px] text-[#858178]">
                Automatically shrinks inactive widgets into compact floating capsules.
              </p>
            </div>
            <button
              onClick={() => setAutoCollapse(!autoCollapse)}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                autoCollapse ? 'bg-[#C5B89D]' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[#242421] transition-transform ${
                  autoCollapse ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Inactivity Delay Slider */}
          <div className="p-3.5 rounded-manager manager-card space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#F1EFE8]">Inactivity Delay</span>
                <p className="text-[11px] text-[#858178]">
                  Seconds of zero interaction before a widget collapses into its capsule.
                </p>
              </div>
              <span className="text-xs font-mono font-medium text-[#C5B89D]">
                {collapseDelaySeconds}s
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="20"
              step="1"
              value={collapseDelaySeconds}
              onChange={(e) => setCollapseDelaySeconds(parseInt(e.target.value))}
              className="w-full accent-[#C5B89D] cursor-pointer"
            />
          </div>

          {/* Default Visibility Mode */}
          <div className="p-3.5 rounded-manager manager-card space-y-2">
            <span className="text-xs font-medium text-[#F1EFE8]">Default Visibility Mode</span>
            <p className="text-[11px] text-[#858178]">
              Elevation layer applied when new widgets are pinned to desktop.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
              {[
                {
                  mode: 'always_on_top' as VisibilityMode,
                  title: 'Always on Top',
                  desc: 'Remains above all ordinary application windows.',
                },
                {
                  mode: 'smart' as VisibilityMode,
                  title: 'Smart Visibility',
                  desc: 'Hides when full-screen applications or presentations run.',
                },
                {
                  mode: 'desktop_only' as VisibilityMode,
                  title: 'Desktop Only',
                  desc: 'Anchors to wallpaper layer behind open apps.',
                },
              ].map((opt) => (
                <button
                  key={opt.mode}
                  onClick={() => handleDefaultVisibilityChange(opt.mode)}
                  className={`p-2.5 rounded-control text-left border transition-all ${
                    settings.default_visibility_mode === opt.mode
                      ? 'bg-[#C5B89D]/15 border-[#C5B89D]/40 text-[#F1EFE8]'
                      : 'bg-white/[0.02] border-white/[0.06] text-[#858178] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold">{opt.title}</span>
                    {settings.default_visibility_mode === opt.mode && (
                      <CheckIcon size={11} className="text-[#C5B89D]" />
                    )}
                  </div>
                  <p className="text-[10px] text-[#858178] leading-tight">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Global Lock Position */}
          <div className="flex items-center justify-between p-3.5 rounded-manager manager-card">
            <div>
              <span className="text-xs font-medium text-[#F1EFE8]">Lock Widget Positions</span>
              <p className="text-[11px] text-[#858178]">
                Disables dragging to prevent accidental movement.
              </p>
            </div>
            <button
              onClick={() => setLockPosition(!lockPosition)}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                lockPosition ? 'bg-[#C9A77D]' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[#242421] transition-transform ${
                  lockPosition ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Snap to Edges */}
          <div className="flex items-center justify-between p-3.5 rounded-manager manager-card">
            <div>
              <span className="text-xs font-medium text-[#F1EFE8]">Magnetic Edge Snapping</span>
              <p className="text-[11px] text-[#858178]">
                Snaps widgets cleanly to monitor perimeters and adjacent capsules.
              </p>
            </div>
            <button
              onClick={() => setSnapToEdges(!snapToEdges)}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                snapToEdges ? 'bg-[#C5B89D]' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[#242421] transition-transform ${
                  snapToEdges ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
