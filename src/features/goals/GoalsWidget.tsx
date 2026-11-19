import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoalStore } from '@/stores/goalStore';
import { PlusIcon, MinusIcon, TrashIcon, CheckIcon } from '@/components/shared/icons';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import { useAppearanceStore } from '@/stores/appearanceStore';

export const GoalsWidget: React.FC = () => {
  const {
    goals,
    fetchGoals,
    addGoal,
    incrementProgress,
    decrementProgress,
    toggleComplete,
    deleteGoal,
    initListeners,
  } = useGoalStore();
  const { reducedMotion } = useAppearanceStore();
  const { isXs } = useWidgetDimensions();

  const [title, setTitle] = useState('');
  const [targetCount, setTargetCount] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchGoals();
    const cleanup = initListeners();
    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addGoal(title.trim(), targetCount);
    setTitle('');
    setTargetCount(1);
    setIsAdding(false);
  };

  const transitionConfig = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 25, stiffness: 400 };

  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.is_completed).length;
  const overallPercentage = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  // XS MICRO VIEW: Compact percentage + active goal
  if (isXs) {
    const activeGoal = goals.find((g) => !g.is_completed);

    return (
      <div className="flex flex-col justify-between h-full w-full select-none text-[#F1EFE8]">
        <div className="flex items-center justify-between text-[10px] text-[#B7B3A9] mb-1">
          <span className="font-medium text-[#F1EFE8]">Daily Goals</span>
          <span className="text-[#9DAE9B] font-mono">{overallPercentage}%</span>
        </div>

        {activeGoal ? (
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="text-xs font-medium text-[#F1EFE8] truncate max-w-[120px]">
              {activeGoal.title}
            </span>
            <div className="flex items-center gap-1 font-mono text-xs">
              <span className="text-[#9DAE9B]">{activeGoal.current_count}</span>
              <span className="text-[#858178]">/</span>
              <span className="text-[#B7B3A9]">{activeGoal.target_count}</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#9DAE9B] text-center p-2 rounded-lg bg-white/[0.02]">
            All goals completed
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full select-none text-[#F1EFE8] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#B7B3A9]">Daily Goals</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/[0.05] text-[10px] font-mono text-[#9DAE9B]">
            {completedGoals}/{totalGoals}
          </span>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="p-1 rounded btn-quiet"
          title="Add Goal"
        >
          <PlusIcon size={12} />
        </button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitionConfig}
            onSubmit={handleAdd}
            className="flex items-center gap-1.5 mb-2.5 p-1.5 rounded-lg bg-[#242421]/60 border border-white/[0.06] shrink-0"
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Habit or target..."
              className="flex-1 px-2 py-1 text-xs input-graphite text-[#F1EFE8]"
              autoFocus
            />
            <input
              type="number"
              min="1"
              max="99"
              value={targetCount}
              onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 px-1 py-1 text-xs text-center input-graphite font-mono text-[#F1EFE8]"
              title="Target count"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded btn-accent text-xs font-medium"
            >
              Add
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Goals List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
        {goals.length === 0 ? (
          <div className="text-center text-xs text-[#858178] py-6">
            No daily goals defined
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {goals.map((goal) => {
              const percentage = Math.min(
                100,
                Math.round((goal.current_count / goal.target_count) * 100)
              );

              return (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={transitionConfig}
                  className={`group flex flex-col p-2 rounded-lg border transition-all ${
                    goal.is_completed
                      ? 'bg-white/[0.01] border-white/[0.03]'
                      : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 overflow-hidden flex-1 mr-2">
                      <button
                        onClick={() => toggleComplete(goal.id)}
                        className={`p-0.5 rounded transition-colors ${
                          goal.is_completed
                            ? 'text-[#9DAE9B]'
                            : 'text-[#858178] hover:text-[#9DAE9B]'
                        }`}
                      >
                        <CheckIcon size={12} strokeWidth={2.5} />
                      </button>
                      <span
                        className={`text-xs font-medium truncate ${
                          goal.is_completed
                            ? 'line-through text-[#858178]'
                            : 'text-[#F1EFE8]'
                        }`}
                      >
                        {goal.title}
                      </span>
                    </div>

                    {/* Counter & Increment/Decrement */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] font-mono text-[#B7B3A9] mr-1">
                        <strong className="text-[#F1EFE8] font-medium">
                          {goal.current_count}
                        </strong>
                        /{goal.target_count}
                      </span>

                      <button
                        onClick={() => decrementProgress(goal.id)}
                        className="p-1 rounded btn-quiet text-[#B7B3A9] hover:text-[#F1EFE8]"
                        title="Decrement"
                      >
                        <MinusIcon size={11} />
                      </button>

                      <button
                        onClick={() => incrementProgress(goal.id)}
                        className="p-1 rounded bg-[#9DAE9B]/15 hover:bg-[#9DAE9B]/25 text-[#9DAE9B] transition-all"
                        title="Increment"
                      >
                        <PlusIcon size={11} />
                      </button>

                      <button
                        onClick={() => deleteGoal(goal.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#858178] hover:text-[#C58D85] transition-all ml-0.5"
                        title="Delete goal"
                      >
                        <TrashIcon size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 bg-[#9DAE9B]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
