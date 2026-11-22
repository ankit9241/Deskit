import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNoteStore } from '@/stores/noteStore';
import {
  PlusIcon,
  TrashIcon,
  PinIcon,
  SearchIcon,
  CheckIcon,
} from '@/components/shared/icons';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import GlassWidget from '@/components/widgets/GlassWidget';

// Lightweight, zero-dependency Markdown parser & renderer
function renderInlineMarkdown(text: string): React.ReactNode {
  // Matches inline code, bold, italic, strikethrough, and links
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // 1. Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push(
        <code
          key={keyIndex++}
          className="px-1 py-0.2 mx-0.5 bg-white/10 rounded font-mono text-[10px] text-[#FF9F0A]"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 2. Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
    if (boldMatch) {
      tokens.push(
        <strong key={keyIndex++} className="font-semibold text-white">
          {renderInlineMarkdown(boldMatch[2])}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 3. Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)(.*?)\1/);
    if (italicMatch && italicMatch[2].length > 0) {
      tokens.push(
        <em key={keyIndex++} className="italic text-white/90">
          {renderInlineMarkdown(italicMatch[2])}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 4. Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/^~~(.*?)~~/);
    if (strikeMatch) {
      tokens.push(
        <del key={keyIndex++} className="line-through text-white/40">
          {renderInlineMarkdown(strikeMatch[1])}
        </del>
      );
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // 5. Links: [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      tokens.push(
        <a
          key={keyIndex++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0A84FF] underline underline-offset-2 hover:text-[#0A84FF]/80 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Literal character fallback
    const plainMatch = remaining.match(/^[^`*_~\[]+/);
    if (plainMatch) {
      tokens.push(plainMatch[0]);
      remaining = remaining.slice(plainMatch[0].length);
    } else {
      tokens.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

interface MarkdownPreviewProps {
  content: string;
  onToggleChecklist: (lineIndex: number) => void;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, onToggleChecklist }) => {
  const elements = useMemo(() => {
    const lines = content.split('\n');
    const nodes: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks ```
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          nodes.push(
            <pre
              key={`code-${i}`}
              className="p-2 my-1 rounded-lg bg-black/50 border border-white/10 font-mono text-[10px] text-white/90 overflow-x-auto custom-scrollbar"
            >
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          );
          codeBlockLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeBlockLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        nodes.push(
          <h1 key={`h1-${i}`} className="text-sm font-bold text-white mt-1.5 mb-0.5">
            {renderInlineMarkdown(line.slice(2))}
          </h1>
        );
        continue;
      }
      if (line.startsWith('## ')) {
        nodes.push(
          <h2 key={`h2-${i}`} className="text-xs font-semibold text-white/95 mt-1.5 mb-0.5">
            {renderInlineMarkdown(line.slice(3))}
          </h2>
        );
        continue;
      }
      if (line.startsWith('### ')) {
        nodes.push(
          <h3 key={`h3-${i}`} className="text-xs font-semibold text-white/80 mt-1 mb-0.5">
            {renderInlineMarkdown(line.slice(4))}
          </h3>
        );
        continue;
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        nodes.push(
          <blockquote
            key={`bq-${i}`}
            className="border-l-2 border-[#0A84FF] pl-2 my-1 text-xs italic text-white/70"
          >
            {renderInlineMarkdown(line.slice(2))}
          </blockquote>
        );
        continue;
      }

      // Horizontal rule
      if (/^(\*\*\*|---|___)$/.test(line.trim())) {
        nodes.push(<hr key={`hr-${i}`} className="border-white/10 my-1.5" />);
        continue;
      }

      // Checklists: - [ ] or - [x] or * [ ] or 1. [ ]
      const checklistMatch = line.match(/^(\s*[-*]|\s*\d+\.)\s*\[([ xX])\]\s*(.*)$/);
      if (checklistMatch) {
        const isChecked = checklistMatch[2].toLowerCase() === 'x';
        const itemText = checklistMatch[3];
        const lineIdx = i;

        nodes.push(
          <div
            key={`check-${i}`}
            className="flex items-start gap-1.5 py-0.5 cursor-pointer group"
            onClick={() => onToggleChecklist(lineIdx)}
          >
            <button
              type="button"
              className={`w-3.5 h-3.5 rounded mt-0.5 flex items-center justify-center shrink-0 transition-all ${
                isChecked
                  ? 'bg-[#30D158] text-black'
                  : 'border border-white/40 group-hover:border-[#30D158]'
              }`}
            >
              {isChecked && <CheckIcon size={9} strokeWidth={2.5} />}
            </button>
            <span
              className={`text-xs leading-relaxed ${
                isChecked ? 'line-through text-white/40' : 'text-white'
              }`}
            >
              {renderInlineMarkdown(itemText)}
            </span>
          </div>
        );
        continue;
      }

      // Unordered lists: - item or * item
      const bulletMatch = line.match(/^(\s*[-*])\s+(.*)$/);
      if (bulletMatch) {
        nodes.push(
          <div key={`bullet-${i}`} className="flex items-start gap-1.5 py-0.5 pl-1">
            <span className="text-[#0A84FF] text-xs leading-relaxed shrink-0">•</span>
            <span className="text-xs leading-relaxed text-white">
              {renderInlineMarkdown(bulletMatch[2])}
            </span>
          </div>
        );
        continue;
      }

      // Ordered lists: 1. item
      const orderedMatch = line.match(/^(\s*(\d+)\.)\s+(.*)$/);
      if (orderedMatch) {
        nodes.push(
          <div key={`num-${i}`} className="flex items-start gap-1.5 py-0.5 pl-1">
            <span className="text-white/50 text-[11px] font-mono leading-relaxed shrink-0">
              {orderedMatch[2]}.
            </span>
            <span className="text-xs leading-relaxed text-white">
              {renderInlineMarkdown(orderedMatch[3])}
            </span>
          </div>
        );
        continue;
      }

      // Empty line
      if (!line.trim()) {
        nodes.push(<div key={`empty-${i}`} className="h-1.5" />);
        continue;
      }

      // Regular paragraph
      nodes.push(
        <p key={`p-${i}`} className="text-xs leading-relaxed text-white/90">
          {renderInlineMarkdown(line)}
        </p>
      );
    }

    if (inCodeBlock && codeBlockLines.length > 0) {
      nodes.push(
        <pre
          key="code-eof"
          className="p-2 my-1 rounded-lg bg-black/50 border border-white/10 font-mono text-[10px] text-white/90 overflow-x-auto custom-scrollbar"
        >
          <code>{codeBlockLines.join('\n')}</code>
        </pre>
      );
    }

    return nodes;
  }, [content, onToggleChecklist]);

  if (!content.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/40 text-xs py-8">
        Empty note. Switch to Edit mode to write.
      </div>
    );
  }

  return (
    <div className="flex-1 w-full overflow-y-auto space-y-0.5 p-1 custom-scrollbar">
      {elements}
    </div>
  );
};

export const NotesWidgetContent: React.FC = () => {
  const {
    notes,
    activeNoteId,
    searchQuery,
    fetchNotes,
    setActiveNoteId,
    setSearchQuery,
    saveNote,
    togglePinNote,
    deleteNote,
    initListeners,
  } = useNoteStore();
  const { isXs, isVeryShort } = useWidgetDimensions();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // References to preserve flush logic across window close / unmount
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const activeNoteIdRef = useRef(activeNoteId);
  const isUserEditingRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  titleRef.current = title;
  contentRef.current = content;
  activeNoteIdRef.current = activeNoteId;

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const activeNote = useMemo(() => {
    if (activeNoteId) {
      const found = notes.find((n) => n.id === activeNoteId);
      if (found) return found;
    }
    return filteredNotes.length > 0 ? filteredNotes[0] : null;
  }, [notes, filteredNotes, activeNoteId]);

  // Flush pending save safely
  const flushSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      if (isUserEditingRef.current) {
        const currentTitle = titleRef.current.trim() || 'Quick Note';
        saveNote(currentTitle, contentRef.current, activeNoteIdRef.current || undefined, activeNote?.is_pinned);
        isUserEditingRef.current = false;
        setIsSaved(true);
      }
    }
  };

  useEffect(() => {
    fetchNotes();
    const cleanup = initListeners();

    const handleBeforeUnload = () => {
      flushSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushSave();
      cleanup.then((fn) => fn && fn());
    };
  }, []);

  // Sync state when active note changes
  useEffect(() => {
    if (activeNote) {
      if (!isUserEditingRef.current) {
        setTitle(activeNote.title || '');
        setContent(activeNote.content || '');
        setIsSaved(true);
      }
    } else {
      if (!isUserEditingRef.current) {
        setTitle('');
        setContent('');
        setIsSaved(true);
      }
    }
  }, [activeNote?.id]);

  // Trigger debounced auto-save on user edit
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    isUserEditingRef.current = true;
    setIsSaved(false);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const currentTitle = titleRef.current.trim() || 'Quick Note';
      await saveNote(currentTitle, newContent, activeNote?.id, activeNote?.is_pinned);
      setIsSaved(true);
      isUserEditingRef.current = false;
    }, 600);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    isUserEditingRef.current = true;
    setIsSaved(false);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await saveNote(newTitle || 'Untitled Note', contentRef.current, activeNote?.id, activeNote?.is_pinned);
      setIsSaved(true);
      isUserEditingRef.current = false;
    }, 600);
  };

  const handleCreateNew = async () => {
    flushSave();
    const newNote = await saveNote('New Note', '', undefined, false);
    if (newNote) {
      setActiveNoteId(newNote.id);
      setTitle(newNote.title);
      setContent('');
      setIsSaved(true);
      isUserEditingRef.current = false;
      setViewMode('edit');
    }
  };

  const handleDelete = async () => {
    if (!activeNote) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await deleteNote(activeNote.id);
    isUserEditingRef.current = false;
  };

  const handleTogglePin = async () => {
    if (!activeNote) return;
    flushSave();
    await togglePinNote(activeNote.id);
  };

  // Interactive Checklist Toggle
  const handleToggleChecklist = (lineIndex: number) => {
    const lines = content.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    const line = lines[lineIndex];

    let newLine = line;
    if (/^(\s*[-*]|\s*\d+\.)\s*\[ \](.*)$/.test(line)) {
      newLine = line.replace(/^(\s*[-*]|\s*\d+\.)\s*\[ \](.*)$/, '$1 [x]$2');
    } else if (/^(\s*[-*]|\s*\d+\.)\s*\[[xX]\](.*)$/.test(line)) {
      newLine = line.replace(/^(\s*[-*]|\s*\d+\.)\s*\[[xX]\](.*)$/, '$1 [ ]$2');
    }

    if (newLine !== line) {
      lines[lineIndex] = newLine;
      const updatedContent = lines.join('\n');
      setContent(updatedContent);
      contentRef.current = updatedContent;
      const currentTitle = titleRef.current.trim() || 'Quick Note';
      saveNote(currentTitle, updatedContent, activeNote?.id, activeNote?.is_pinned);
      setIsSaved(true);
      isUserEditingRef.current = false;
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  // MICRO / XS VIEW: Compact scratchpad
  if (isXs || isVeryShort) {
    return (
      <div className="flex flex-col h-full w-full select-none text-white justify-between p-0.5">
        <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
          <span className="font-semibold truncate max-w-[120px]">
            {activeNote?.is_pinned ? `📌 ${title || 'Quick Note'}` : (title || 'Quick Note')}
          </span>
          <span className={`text-[9px] font-mono ${isSaved ? 'text-[#30D158]' : 'text-[#FF9F0A]'}`}>
            {isSaved ? '• Saved' : '• Saving...'}
          </span>
        </div>
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Type quick thought..."
          className="flex-1 w-full bg-transparent resize-none outline-none text-xs text-white placeholder-white/40 custom-scrollbar leading-relaxed font-sans"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full select-none text-white overflow-hidden">
      {/* Top Bar: Note Selector, Pin, Search, Add, Delete, Edit/Preview Mode, Save Status */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5 shrink-0">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {notes.length > 0 ? (
            <select
              value={activeNote?.id || ''}
              onChange={(e) => {
                flushSave();
                setActiveNoteId(e.target.value);
              }}
              className="px-1.5 py-0.5 text-xs bg-black/40 border border-white/10 rounded-lg text-white outline-none max-w-[130px] truncate cursor-pointer hover:border-white/25 transition-colors font-medium"
            >
              {filteredNotes.map((n) => (
                <option key={n.id} value={n.id} className="bg-[#1C1C1E]">
                  {n.is_pinned ? `📌 ${n.title || 'Untitled Note'}` : (n.title || 'Untitled Note')}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-semibold text-white">Notes</span>
          )}

          {/* Pin Button */}
          {activeNote && (
            <button
              type="button"
              onClick={handleTogglePin}
              className={`p-1 rounded-md transition-colors ${
                activeNote.is_pinned
                  ? 'text-[#FF9F0A] bg-[#FF9F0A]/15'
                  : 'btn-quiet text-white/40 hover:text-white'
              }`}
              title={activeNote.is_pinned ? 'Unpin note' : 'Pin note to top'}
            >
              <PinIcon size={12} filled={Boolean(activeNote.is_pinned)} />
            </button>
          )}

          {/* Search Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(!isSearchOpen);
              if (isSearchOpen) setSearchQuery('');
            }}
            className={`p-1 rounded-md transition-colors ${
              isSearchOpen || searchQuery
                ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
                : 'btn-quiet text-white/40 hover:text-white'
            }`}
            title="Search notes"
          >
            <SearchIcon size={12} />
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="p-1 rounded-md btn-quiet text-white/70 hover:text-white"
            title="Create New Note"
          >
            <PlusIcon size={12} />
          </button>

          {activeNote && (
            <button
              type="button"
              onClick={handleDelete}
              className="p-1 rounded-md btn-quiet text-white/40 hover:text-[#FF453A]"
              title="Delete Current Note"
            >
              <TrashIcon size={12} />
            </button>
          )}
        </div>

        {/* View Mode Toggle (Edit vs Preview) & Save Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/10 text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-1.5 py-0.2 rounded transition-all ${
                viewMode === 'edit'
                  ? 'bg-white/20 text-white font-medium shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                flushSave();
                setViewMode('preview');
              }}
              className={`px-1.5 py-0.2 rounded transition-all ${
                viewMode === 'preview'
                  ? 'bg-white/20 text-white font-medium shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Preview
            </button>
          </div>

          <div className="text-[9px] font-mono shrink-0">
            {isSaved ? (
              <span className="text-[#30D158] font-medium">• Saved</span>
            ) : (
              <span className="text-[#FF9F0A] font-medium">• Saving...</span>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Search Input */}
      {isSearchOpen && (
        <div className="mb-1.5 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes by title or content..."
            className="w-full px-2 py-0.5 text-xs bg-black/40 border border-white/15 rounded-lg outline-none text-white placeholder-white/40 focus:border-[#0A84FF]/60 transition-colors"
            autoFocus
          />
        </div>
      )}

      {/* Title Input */}
      <input
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Note Title..."
        className="w-full px-1 py-0.5 mb-1 text-xs font-semibold bg-transparent border-b border-white/10 focus:border-[#0A84FF]/60 outline-none text-white placeholder-white/40 transition-colors"
      />

      {/* Content Area: Raw Markdown Editor OR Rich Preview Mode */}
      {viewMode === 'edit' ? (
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Write notes in Markdown... (headings, - [ ] checklists, *italic*, **bold**)"
          className="flex-1 w-full bg-transparent resize-none outline-none text-xs text-white placeholder-white/40 p-1 leading-relaxed custom-scrollbar font-sans"
        />
      ) : (
        <MarkdownPreview
          content={content}
          onToggleChecklist={handleToggleChecklist}
        />
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 border-t border-white/[0.06] mt-1 shrink-0 font-mono">
        <span>
          {filteredNotes.length}{' '}
          {filteredNotes.length === 1 ? 'note' : 'notes'}
          {searchQuery && ` (filtered)`}
        </span>
        <span>
          {wordCount} words • {charCount} chars
        </span>
      </div>
    </div>
  );
};

export const NotesWidget: React.FC = () => {
  return (
    <GlassWidget>
      <NotesWidgetContent />
    </GlassWidget>
  );
};

export default NotesWidget;
