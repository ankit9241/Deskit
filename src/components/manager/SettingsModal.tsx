import React from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, toggleAutostart, toggleCloseToTray, toggleTimeFormat } = useSettingsStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden select-none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-800/40">
          <h2 className="text-sm font-bold text-white tracking-wide">PINNED Preferences</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Autostart Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800">
            <div>
              <div className="font-semibold text-slate-200">Launch at Windows Login</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Automatically launch PINNED and restore your pinned widgets upon user login.
              </div>
            </div>
            <button
              onClick={toggleAutostart}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ml-3 ${
                settings.launch_at_login ? 'bg-sky-500 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* Close to Tray Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800">
            <div>
              <div className="font-semibold text-slate-200">Close to System Tray</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Closing the manager window minimizes it to the Windows notification tray.
              </div>
            </div>
            <button
              onClick={toggleCloseToTray}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ml-3 ${
                settings.close_to_tray ? 'bg-sky-500 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* 24-Hour Time Format Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800">
            <div>
              <div className="font-semibold text-slate-200">24-Hour Time Format</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Display clock in 24-hour military format (e.g. 14:30) instead of 12-hour.
              </div>
            </div>
            <button
              onClick={toggleTimeFormat}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ml-3 ${
                settings.time_format_24h ? 'bg-sky-500 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* Technical Info */}
          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono space-y-1">
            <div>Target: Windows 10 &amp; 11 (Win32 HWND_TOPMOST SetWindowPos)</div>
            <div>Runtime: Tauri 2 + Rust MSVC + SQLite Persistence</div>
            <div>Single Instance: Enabled via Tauri Single Instance Plugin</div>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
