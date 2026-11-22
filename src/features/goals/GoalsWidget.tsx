import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoalStore } from '@/stores/goalStore';
import { PlusIcon, MinusIcon, TrashIcon, CheckIcon } from '@/components/shared/icons';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import { useAppearanceStore } from '@/stores/appearanceStore';
import GlassWidget from '@/components/widgets/GlassWidget';

export const GoalsWidgetContent: React.FC = () => {
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
  const { isXs, isVeryShort } = useWidgetDimensions();

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
    addGoal(title.trim(), Math.max(1, targetCount));
    setTitle('');
    setTargetCount(1);
    setIsAdding(false);
  };

  const targetPresets = [1, 3, 5, 8, 10];

  const transitionConfig = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 25, stiffness: 400 };

  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.is_completed).length;
  const overallPercentage = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  // MICRO / XS VIEW: Compact percentage + active goal
  if (isXs || isVeryShort) {
    const activeGoal = goals.find((g) => !g.is_completed);

    return (
      <div className="flex flex-col justify-between h-full w-full select-none text-white p-0.5">
        <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
          <span className="font-semibold text-white">Daily Goals</span>
          <span className="text-[#30D158] font-mono">{overallPercentage}%</span>
        </div>

        {activeGoal ? (
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.04] border border-white/10">
            <span className="text-xs font-medium text-white truncate max-w-[120px]">
              {activeGoal.title}
            </span>
            <div className="flex items-center gap-1 font-mono text-xs">
              <span className="text-[#30D158]">{activeGoal.current_count}</span>
              <span className="text-white/40">/</span>
              <span className="text-white/70">{activeGoal.target_count}</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#30D158] text-center p-1.5 rounded-lg bg-white/[0.03]">
            All goals completed
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full select-none text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white">Daily Goals</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] font-mono text-[#30D158]">
            {completedGoals}/{totalGoals}
          </span>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`p-1 rounded-lg transition-colors ${
            isAdding ? 'bg-white/20 text-white' : 'btn-quiet'
          }`}
          title="Add Goal"
        >
          <PlusIcon size={12} />
        </button>
      </div>

      {/* Add Form with Manual Target Controls */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitionConfig}
            onSubmit={handleAdd}
            className="flex flex-col gap-1.5 mb-2.5 p-2 rounded-xl bg-black/50 border border-white/15 shrink-0"
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Habit or target name..."
              className="px-2 py-1 text-xs bg-white/10 border border-white/15 rounded-lg outline-none text-white placeholder-white/40"
              autoFocus
            />

            <div className="flex items-center justify-between gap-1 flex-wrap">
              {/* Quick Target Chips */}
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-white/50">Target:</span>
                {targetPresets.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setTargetCount(cnt)}
                    className={`px-1.5 py-0.2 rounded text-[9px] font-mono transition-all ${
                      targetCount === cnt
                        ? 'bg-[#30D158] text-black font-semibold'
                        : 'bg-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    {cnt}x
                  </button>
                ))}
              </div>

              {/* Custom Target Number Input */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={targetCount}
                  onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 px-1 py-0.5 text-xs text-center bg-white/10 border border-white/15 rounded-lg font-mono text-white outline-none"
                  title="Custom target count"
                />
                <button
                  type="submit"
                  className="px-2.5 py-0.5 rounded-lg btn-accent text-xs font-semibold shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Goals List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
        {goals.length === 0 ? (
          <div className="text-center text-xs text-white/40 py-6">
            No daily goals defined
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {goals.map((goal) => {
              const percentage = Math.min(
                100,
                Math.round((goal.current_count / (goal.target_count || 1)) * 100)
              );

              return (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={transitionConfig}
                  className={`group flex flex-col p-2 rounded-xl border transition-all ${
                    goal.is_completed
                      ? 'bg-white/[0.02] border-white/[0.04]'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 overflow-hidden flex-1 mr-2">
                      <button
                        onClick={() => toggleComplete(goal.id)}
                        className={`p-0.5 rounded transition-colors ${
                          goal.is_completed
                            ? 'text-[#30D158]'
                            : 'text-white/40 hover:text-[#30D158]'
                        }`}
                      >
                        <CheckIcon size={12} strokeWidth={2.5} />
                      </button>
                      <span
                        className={`text-xs font-medium truncate ${
                          goal.is_completed
                            ? 'line-through text-white/40'
                            : 'text-white'
                        }`}
                      >
                        {goal.title}
                      </span>
                      {goal.current_streak !== undefined && goal.current_streak > 0 && (
                        <span
                          className="text-[10px] text-[#FF9F0A] font-mono shrink-0 ml-1"
                          title={`Current streak: ${goal.current_streak} days (Best: ${goal.longest_streak || goal.current_streak} days)`}
                        >
                          🔥{goal.current_streak}
                        </span>
                      )}
                    </div>

                    {/* Counter & Increment/Decrement */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] font-mono text-white/70 mr-1">
                        <strong className="text-white font-medium">
                          {goal.current_count}
                        </strong>
                        /{goal.target_count}
                      </span>

                      <button
                        onClick={() => decrementProgress(goal.id)}
                        className="p-1 rounded-md btn-quiet text-white/60 hover:text-white"
                        title="Decrement count"
                      >
                        <MinusIcon size={11} />
                      </button>

                      <button
                        onClick={() => incrementProgress(goal.id)}
                        className="p-1 rounded-md bg-[#30D158]/20 hover:bg-[#30D158]/30 text-[#30D158] transition-all"
                        title="Increment count"
                      >
                        <PlusIcon size={11} />
                      </button>

                      <button
                        onClick={() => deleteGoal(goal.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-white/40 hover:text-[#FF453A] transition-all ml-0.5"
                        title="Delete goal"
                      >
                        <TrashIcon size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 bg-[#30D158]"
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

export const GoalsWidget: React.FC = () => {
  return (
    <GlassWidget>
      <GoalsWidgetContent />
    </GlassWidget>
  );
};

export default GoalsWidget;
