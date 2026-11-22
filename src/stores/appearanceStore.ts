import { create } from 'zustand';

export interface AppearanceState {
  opacity: number;
  blur: number;
  density: 'compact' | 'normal' | 'comfortable';
  reducedMotion: boolean;
  lockPosition: boolean;
  snapToEdges: boolean;
  activeWorkspace: string | null;
  autoCollapse: boolean;
  collapseDelaySeconds: number;
  setOpacity: (val: number) => void;
  setBlur: (val: number) => void;
  setDensity: (val: 'compact' | 'normal' | 'comfortable') => void;
  setReducedMotion: (val: boolean) => void;
  setLockPosition: (val: boolean) => void;
  setSnapToEdges: (val: boolean) => void;
  setActiveWorkspace: (val: string | null) => void;
  setAutoCollapse: (val: boolean) => void;
  setCollapseDelaySeconds: (val: number) => void;
  applyCssVariables: () => void;
}

const STORAGE_KEY = 'deskit_appearance_preferences';

function getInitialState() {
  const fallback = {
    opacity: 0.88,
    blur: 24,
    density: 'normal' as const,
    reducedMotion: false,
    lockPosition: false,
    snapToEdges: true,
    activeWorkspace: null,
    autoCollapse: true,
    collapseDelaySeconds: 5,
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        opacity: typeof parsed.opacity === 'number' ? parsed.opacity : fallback.opacity,
        blur: typeof parsed.blur === 'number' ? parsed.blur : fallback.blur,
        density: parsed.density || fallback.density,
        reducedMotion: !!parsed.reducedMotion,
        lockPosition: !!parsed.lockPosition,
        snapToEdges: parsed.snapToEdges !== false,
        activeWorkspace: parsed.activeWorkspace || null,
        autoCollapse: parsed.autoCollapse !== undefined ? !!parsed.autoCollapse : true,
        collapseDelaySeconds: typeof parsed.collapseDelaySeconds === 'number' ? parsed.collapseDelaySeconds : 5,
      };
    }
  } catch {
    // Ignore error
  }

  const systemReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    ...fallback,
    reducedMotion: systemReducedMotion,
  };
}

export const useAppearanceStore = create<AppearanceState>((set, get) => {
  const initial = getInitialState();

  const sync = (state: Partial<AppearanceState>) => {
    try {
      const merged = { ...get(), ...state };
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          opacity: merged.opacity,
          blur: merged.blur,
          density: merged.density,
          reducedMotion: merged.reducedMotion,
          lockPosition: merged.lockPosition,
          snapToEdges: merged.snapToEdges,
          activeWorkspace: merged.activeWorkspace,
          autoCollapse: merged.autoCollapse,
          collapseDelaySeconds: merged.collapseDelaySeconds,
        })
      );
      window.dispatchEvent(new Event('deskit_appearance_updated'));
    } catch {
      // Ignore
    }
  };

  return {
    ...initial,
    setOpacity: (val) => {
      set({ opacity: val });
      sync({ opacity: val });
      get().applyCssVariables();
    },
    setBlur: (val) => {
      set({ blur: val });
      sync({ blur: val });
      get().applyCssVariables();
    },
    setDensity: (val) => {
      set({ density: val });
      sync({ density: val });
    },
    setReducedMotion: (val) => {
      set({ reducedMotion: val });
      sync({ reducedMotion: val });
    },
    setLockPosition: (val) => {
      set({ lockPosition: val });
      sync({ lockPosition: val });
    },
    setSnapToEdges: (val) => {
      set({ snapToEdges: val });
      sync({ snapToEdges: val });
    },
    setActiveWorkspace: (val) => {
      set({ activeWorkspace: val });
      sync({ activeWorkspace: val });
    },
    setAutoCollapse: (val) => {
      set({ autoCollapse: val });
      sync({ autoCollapse: val });
    },
    setCollapseDelaySeconds: (val) => {
      set({ collapseDelaySeconds: val });
      sync({ collapseDelaySeconds: val });
    },
    applyCssVariables: () => {
      if (typeof document === 'undefined') return;
      const { opacity, blur } = get();
      document.documentElement.style.setProperty('--widget-opacity', opacity.toString());
      document.documentElement.style.setProperty('--widget-blur', `${blur}px`);
    },
  };
});

// Auto-sync CSS variables on mount in any window
if (typeof window !== 'undefined') {
  useAppearanceStore.getState().applyCssVariables();
  const syncAppearance = () => {
    const updated = getInitialState();
    useAppearanceStore.setState(updated);
    useAppearanceStore.getState().applyCssVariables();
  };
  window.addEventListener('deskit_appearance_updated', syncAppearance);
}
