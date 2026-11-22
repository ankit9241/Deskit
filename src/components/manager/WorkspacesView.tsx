import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { WidgetType } from '@/types/widget';
import {
  PlayIcon,
  CheckIcon,
  TrashIcon,
  PlusIcon,
} from '@/components/shared/icons';

interface WorkspacePreset {
  id: string;
  name: string;
  description: string;
  widgets: WidgetType[];
  badge: string;
}

const PRESET_DEFINITIONS: WorkspacePreset[] = [
  {
    id: 'study',
    name: 'Study & Deep Work',
    description: 'Focus timer, tasks, clock, and daily habit goals for uninterrupted study sessions.',
    widgets: ['clock', 'tasks', 'focus', 'goals'],
    badge: 'Focus Presets',
  },
  {
    id: 'developer',
    name: 'Developer Workspace',
    description: 'Milestone deadlines, scratchpad for snippets, task tracker, and clock.',
    widgets: ['clock', 'tasks', 'notes', 'deadlines'],
    badge: 'Creator Presets',
  },
  {
    id: 'minimal',
    name: 'Zen Minimalist',
    description: 'Zero clutter. Only the clock and a circular focus timer on your desktop.',
    widgets: ['clock', 'focus'],
    badge: 'Lightweight',
  },
];

export const WorkspacesView: React.FC = () => {
  const { widgets } = useWidgetStore();
  const {
    workspaces,
    activeWorkspace,
    fetchWorkspaces,
    switchWorkspace,
    saveCurrentWorkspace,
    deleteWorkspace,
    initListeners,
  } = useWorkspaceStore();

  const [isSaving, setIsSaving] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [activeApplyingId, setActiveApplyingId] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkspaces();
    let cleanup: (() => void) | undefined;
    initListeners().then((unlisten) => {
      cleanup = unlisten;
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [fetchWorkspaces, initListeners]);

  const handleApplyPreset = async (presetId: string) => {
    setActiveApplyingId(presetId);
    try {
      await switchWorkspace(presetId);
    } finally {
      setTimeout(() => setActiveApplyingId(null), 600);
    }
  };

  const handleApplyCustom = async (workspaceId: string) => {
    setActiveApplyingId(workspaceId);
    try {
      await switchWorkspace(workspaceId);
    } finally {
      setTimeout(() => setActiveApplyingId(null), 600);
    }
  };

  const handleSaveCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    if (widgets.length === 0) {
      alert('Please pin at least one widget to desktop before saving a workspace layout.');
      return;
    }

    try {
      await saveCurrentWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setIsSaving(false);
    } catch (err) {
      alert(`Failed to save workspace: ${err}`);
    }
  };

  const handleDeleteCustom = async (id: string) => {
    await deleteWorkspace(id);
  };

  const builtInIds = new Set(['default', 'study', 'developer', 'minimal']);
  const customWorkspaces = workspaces.filter((w) => !builtInIds.has(w.id));

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[#F1EFE8]">
            Productivity Workspaces
          </h2>
          <p className="text-xs text-[#858178]">
            Switch instant desktop widget configurations tailored for your focus mode.
          </p>
        </div>

        <button
          onClick={() => setIsSaving(!isSaving)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-control btn-quiet text-xs font-medium border border-white/[0.06]"
        >
          <PlusIcon size={12} />
          <span>Save Current Layout</span>
        </button>
      </div>

      {/* Save Workspace Form */}
      <AnimatePresence>
        {isSaving && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSaveCurrent}
            className="flex items-center gap-2 p-3 rounded-manager bg-[#302F2B] border border-white/[0.08]"
          >
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="Name this workspace (e.g. Morning Sprint)..."
              className="flex-1 px-3 py-1.5 text-xs input-graphite text-[#F1EFE8]"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-control btn-accent text-xs"
            >
              Save Layout
            </button>
            <button
              type="button"
              onClick={() => setIsSaving(false)}
              className="px-3 py-1.5 rounded-control btn-quiet text-xs"
            >
              Cancel
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Built-in Presets */}
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wider text-[#858178] mb-3">
          Curated Presets
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PRESET_DEFINITIONS.map((preset) => {
            const isApplying = activeApplyingId === preset.id;
            const isActive = activeWorkspace?.id === preset.id;

            return (
              <div
                key={preset.id}
                className={`p-3.5 rounded-manager manager-card flex flex-col justify-between ${
                  isActive ? 'border-[#C5B89D]/40 shadow-sm' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#F1EFE8]">{preset.name}</span>
                    <span className="text-[9px] text-[#C5B89D] px-1.5 py-0.2 rounded bg-[#C5B89D]/10 font-mono">
                      {preset.badge}
                    </span>
                  </div>

                  <p className="text-xs text-[#858178] mb-3 leading-relaxed">
                    {preset.description}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {preset.widgets.map((w) => (
                      <span
                        key={w}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#B7B3A9] font-mono capitalize"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleApplyPreset(preset.id)}
                  disabled={isApplying}
                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-control text-xs ${
                    isActive ? 'btn-quiet text-[#C5B89D]' : 'btn-accent'
                  }`}
                >
                  {isApplying ? (
                    <>
                      <CheckIcon size={12} strokeWidth={2.5} />
                      <span>Applying...</span>
                    </>
                  ) : isActive ? (
                    <>
                      <CheckIcon size={12} />
                      <span>Current Workspace</span>
                    </>
                  ) : (
                    <>
                      <PlayIcon size={10} />
                      <span>Launch Workspace</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* User Custom Saved Workspaces */}
      {customWorkspaces.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#858178] mb-3">
            Custom Saved Layouts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customWorkspaces.map((custom) => {
              const isApplying = activeApplyingId === custom.id;
              const isActive = activeWorkspace?.id === custom.id;

              return (
                <div
                  key={custom.id}
                  className={`flex items-center justify-between p-3 rounded-manager manager-card ${
                    isActive ? 'border-[#C5B89D]/40' : ''
                  }`}
                >
                  <div className="truncate mr-2">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-semibold text-[#F1EFE8] truncate">
                        {custom.name}
                      </h4>
                      {isActive && (
                        <span className="text-[9px] text-[#C5B89D] px-1 rounded bg-[#C5B89D]/15 font-mono">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#858178] font-mono">
                      {custom.widgets.length} widgets
                      {custom.created_at ? ` • Saved ${custom.created_at.split('T')[0]}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleApplyCustom(custom.id)}
                      disabled={isApplying || isActive}
                      className={`px-2.5 py-1 rounded-control text-xs ${
                        isActive ? 'btn-quiet text-[#858178]' : 'btn-accent'
                      }`}
                    >
                      {isApplying ? 'Applying...' : isActive ? 'Active' : 'Restore'}
                    </button>
                    <button
                      onClick={() => handleDeleteCustom(custom.id)}
                      className="p-1.5 rounded-control btn-quiet text-[#858178] hover:text-[#C58D85]"
                      title="Delete layout"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
