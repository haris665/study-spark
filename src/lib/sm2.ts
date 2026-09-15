/**
 * SuperMemo SM-2 Spaced Repetition Algorithm
 *
 * Quality rating q (0 to 5):
 * 5: Perfect recall, zero hesitation
 * 4: Correct recall after hesitation
 * 3: Correct recall with serious difficulty (pass)
 * 2: Incorrect response; correct answer seemed easy upon reveal
 * 1: Incorrect response; remembered correct answer
 * 0: Complete blackout
 */

export interface SM2State {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  dueAt: string; // ISO timestamp
}

export function calculateSM2(
  quality: number, // 0..5
  prevInterval = 1,
  prevEase = 2.5,
  prevRepetitions = 0,
): SM2State {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  // Calculate new Ease Factor (EF)
  let easeFactor = prevEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  let repetitions = prevRepetitions;
  let intervalDays = prevInterval;

  if (q >= 3) {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(prevInterval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    intervalDays = 1;
  }

  const nextDueDate = new Date(Date.now() + intervalDays * 86400000);

  return {
    intervalDays,
    easeFactor: Math.round(easeFactor * 100) / 100,
    repetitions,
    dueAt: nextDueDate.toISOString(),
  };
}

/**
 * Convert user drill accuracy (0 to 100%) to SM-2 quality score (0 to 5)
 */
export function accuracyToSM2Quality(accuracyPercent: number): number {
  if (accuracyPercent >= 95) return 5;
  if (accuracyPercent >= 80) return 4;
  if (accuracyPercent >= 65) return 3;
  if (accuracyPercent >= 45) return 2;
  if (accuracyPercent >= 20) return 1;
  return 0;
}

/**
 * Format due date for UI (e.g., "Due Today", "Due in 3d", "Overdue by 2d")
 */
export function formatSM2DueDate(dueAtISO: string | null | undefined): {
  label: string;
  isOverdue: boolean;
  isDueToday: boolean;
  colorClass: string;
} {
  if (!dueAtISO) {
    return {
      label: "Due Today",
      isOverdue: false,
      isDueToday: true,
      colorClass: "text-amber border-amber/30 bg-amber/10",
    };
  }

  const due = new Date(dueAtISO);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      label: `Overdue by ${absDays}d`,
      isOverdue: true,
      isDueToday: false,
      colorClass: "text-rose border-rose/30 bg-rose/10 font-bold animate-pulse",
    };
  }

  if (diffDays === 0) {
    return {
      label: "Due Today",
      isOverdue: false,
      isDueToday: true,
      colorClass: "text-amber border-amber/30 bg-amber/10 font-semibold",
    };
  }

  return {
    label: `Due in ${diffDays}d`,
    isOverdue: false,
    isDueToday: false,
    colorClass: "text-accent border-accent/30 bg-accent/10",
  };
}
