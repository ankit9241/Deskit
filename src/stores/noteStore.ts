import { create } from 'zustand';
import { Note } from '@/types/note';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface NoteState {
  notes: Note[];
  activeNoteId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchNotes: () => Promise<void>;
  setActiveNoteId: (id: string | null) => void;
  saveNote: (title: string, content: string, id?: string) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<void>;
  initListeners: () => Promise<() => void>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  activeNoteId: null,
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

  saveNote: async (title, content, id) => {
    try {
      const saved = await api.saveNote({
        id: id || '',
        title: title || 'Untitled Note',
        content,
      });
      set((state) => {
        const exists = state.notes.some((n) => n.id === saved.id);
        const updatedNotes = exists
          ? state.notes.map((n) => (n.id === saved.id ? saved : n))
          : [saved, ...state.notes];
        return {
          notes: updatedNotes,
          activeNoteId: saved.id,
        };
      });
      return saved;
    } catch (err: unknown) {
      set({ error: String(err) });
      return null;
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
