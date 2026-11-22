import { create } from 'zustand';
import { Note } from '@/types/note';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface NoteState {
  notes: Note[];
  activeNoteId: string | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  fetchNotes: () => Promise<void>;
  setActiveNoteId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  saveNote: (title: string, content: string, id?: string, isPinned?: boolean) => Promise<Note | null>;
  togglePinNote: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  initListeners: () => Promise<() => void>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  searchQuery: '',
  isLoading: false,
  error: null,

  fetchNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const notes = await api.getNotes();
      set((state) => ({
        notes,
        isLoading: false,
        activeNoteId: state.activeNoteId || (notes.length > 0 ? notes[0].id : null),
      }));
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  setActiveNoteId: (id) => set({ activeNoteId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  saveNote: async (title, content, id, isPinned) => {
    try {
      const existing = id ? get().notes.find((n) => n.id === id) : undefined;
      const saved = await api.saveNote({
        id: id || '',
        title: title.trim() || 'Untitled Note',
        content: content || '',
        is_pinned: isPinned !== undefined ? isPinned : (existing?.is_pinned ?? false),
      });
      if (saved) {
        set((state) => {
          const exists = state.notes.some((n) => n.id === saved.id);
          const updatedNotes = exists
            ? state.notes.map((n) => (n.id === saved.id ? saved : n))
            : [saved, ...state.notes];
          // Keep pinned order: pinned first, then updated_at desc
          updatedNotes.sort((a, b) => {
            if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) {
              return a.is_pinned ? -1 : 1;
            }
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          });
          return {
            notes: updatedNotes,
            activeNoteId: saved.id,
          };
        });
      }
      return saved;
    } catch (err: unknown) {
      set({ error: String(err) });
      return null;
    }
  },

  togglePinNote: async (id) => {
    try {
      const updated = await api.togglePinNote(id);
      set((state) => {
        const updatedNotes = state.notes.map((n) => (n.id === id ? updated : n));
        updatedNotes.sort((a, b) => {
          if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) {
            return a.is_pinned ? -1 : 1;
          }
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        return { notes: updatedNotes };
      });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  deleteNote: async (id) => {
    try {
      await api.deleteNote(id);
      set((state) => {
        const remaining = state.notes.filter((n) => n.id !== id);
        return {
          notes: remaining,
          activeNoteId: state.activeNoteId === id ? (remaining[0]?.id || null) : state.activeNoteId,
        };
      });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  initListeners: async () => {
    const unlisten = await onEvent('notes-updated', () => {
      get().fetchNotes();
    });
    return unlisten;
  },
}));
