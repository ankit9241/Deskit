import React from 'react';
import { WidgetMetadata } from '@/types/widget';
import { WidgetCard } from './WidgetCard';

const AVAILABLE_WIDGETS: WidgetMetadata[] = [
  {
    type: 'clock',
    name: 'Clock & Date',
    description: 'Minimal local time, seconds, date and 12/24 hour preference on your desktop.',
    defaultWidth: 260,
    defaultHeight: 140,
    minWidth: 200,
    minHeight: 110,
    iconName: 'Clock',
  },
  {
    type: 'tasks',
    name: 'Quick Tasks',
    description: 'Keep your immediate to-dos in view with priority badges and quick completion.',
    defaultWidth: 320,
    defaultHeight: 420,
    minWidth: 280,
    minHeight: 260,
    iconName: 'CheckSquare',
  },
  {
    type: 'focus',
    name: 'Focus Timer',
    description: 'Structured Pomodoro-style focus sessions and breaks to maintain flow state.',
    defaultWidth: 280,
    defaultHeight: 220,
    minWidth: 240,
    minHeight: 180,
    iconName: 'Timer',
  },
  {
    type: 'notes',
    name: 'Scratchpad Notes',
    description: 'Persistent auto-saving notepad always visible alongside code or design tools.',
    defaultWidth: 320,
    defaultHeight: 360,
    minWidth: 260,
    minHeight: 220,
    iconName: 'FileText',
  },
  {
    type: 'deadlines',
    name: 'Deadlines Tracker',
    description: 'Countdown timers and clear status alerts for critical upcoming milestones.',
    defaultWidth: 320,
    defaultHeight: 380,
    minWidth: 260,
    minHeight: 240,
    iconName: 'Calendar',
  },
  {
    type: 'goals',
    name: 'Daily Goals',
    description: 'Daily habit and metric counters with progress bars that reset daily.',
    defaultWidth: 320,
    defaultHeight: 380,
    minWidth: 260,
    minHeight: 240,
    iconName: 'Target',
  },
];

export const WidgetGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {AVAILABLE_WIDGETS.map((widget) => (
        <WidgetCard key={widget.type} metadata={widget} />
      ))}
    </div>
  );
};
