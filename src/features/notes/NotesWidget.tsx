import React, { useState, useEffect } from 'react';
import { useNoteStore } from '@/stores/noteStore';
import { PlusIcon, TrashIcon } from '@/components/shared/icons';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';

export const NotesWidget: React.FC = () => {
  const {
    notes,
    activeNoteId,
    fetchNotes,
    setActiveNoteId,
    saveNote,
    deleteNote,
    initListeners,
  } = useNoteStore();
  const { isXs, isL } = useWidgetDimensions();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaved, setIsSaved] = useState(true);

  useEffect(() => {
    fetchNotes();
    const cleanup = initListeners();
    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, []);

  const activeNote = notes.find((n) => n.id === activeNoteId);

  useEffect(() => {
    if (activeNote) {
      setTitle(activeNote.title);
      setContent(activeNote.content);
      setIsSaved(true);
    } else if (notes.length === 0) {
      setTitle('');
      setContent('');
      setIsSaved(true);
    }
  }, [activeNoteId, notes]);

  // Debounced auto-save
  useEffect(() => {
    if (!activeNoteId && !content && !title) return;
    setIsSaved(false);

    const timeout = setTimeout(() => {
      if (activeNote && (title !== activeNote.title || content !== activeNote.content)) {
        saveNote(title, content, activeNote.id);
        setIsSaved(true);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [title, content]);

  const handleCreateNew = () => {
    saveNote('Quick Note', '');
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  // XS MICRO VIEW: Scratchpad
  if (isXs) {
    return (
      <div className="flex flex-col h-full w-full select-none text-[#F1EFE8] justify-between">
        <div className="flex items-center justify-between text-[10px] text-[#B7B3A9] mb-1">
          <span className="font-medium truncate max-w-[120px]">{title || 'Scratchpad'}</span>
          <span className="text-[#9DAE9B] text-[10px] font-mono">• Saved</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Quick thought..."
          className="flex-1 w-full bg-transparent resize-none outline-none text-xs text-[#F1EFE8] placeholder-[#858178] custom-scrollbar"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full select-none text-[#F1EFE8] overflow-hidden">
      {/* Selector & Actions */}
      <div className="flex items-center justify-between gap-1.5 mb-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
          {notes.length > 1 ? (
            <select
              value={activeNoteId || ''}
              onChange={(e) => setActiveNoteId(e.target.value)}
              className="px-2 py-0.5 text-xs bg-[#242421] border border-white/[0.08] rounded-md text-[#F1EFE8] outline-none max-w-[140px] truncate"
            >
              {notes.map((n) => (
                <option key={n.id} value={n.id} className="bg-[#242421]">
                  {n.title || 'Untitled'}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-medium text-[#B7B3A9]">Notes</span>
          )}

          <button
            onClick={handleCreateNew}
            className="p-1 rounded btn-quiet"
            title="New Note"
          >
            <PlusIcon size={12} />
          </button>

          {activeNote && (
            <button
              onClick={() => deleteNote(activeNote.id)}
              className="p-1 rounded btn-quiet text-[#858178] hover:text-[#C58D85]"
              title="Delete Note"
            >
              <TrashIcon size={12} />
            </button>
          )}
        </div>

        {/* Small Saved Indicator */}
        <div className="flex items-center gap-1 text-[10px] text-[#B7B3A9] shrink-0 font-medium">
          {isSaved ? (
            <span className="flex items-center gap-1 text-[#9DAE9B]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9DAE9B]" />
              Saved
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#C9A77D]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A77D] animate-pulse" />
              Saving...
            </span>
          )}
        </div>
      </div>

      {/* Title Input */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note Title..."
        className="w-full px-1.5 py-0.5 mb-1 text-xs font-medium bg-transparent border-b border-white/[0.06] focus:border-[#C5B89D]/40 outline-none text-[#F1EFE8] placeholder-[#858178]"
      />

      {/* Note Area */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write note content here..."
        className="flex-1 w-full p-2 text-xs bg-[#242421]/40 rounded-lg border border-white/[0.04] resize-none outline-none focus:border-white/[0.10] placeholder-[#858178] text-[#F1EFE8] custom-scrollbar leading-relaxed"
      />

      {/* Footer */}
      {isL && (
        <div className="flex items-center justify-between text-[10px] text-[#858178] mt-1.5 px-1 shrink-0 font-mono">
          <span>{wordCount} words</span>
          <span>SQLite Synced</span>
        </div>
      )}
    </div>
  );
};
