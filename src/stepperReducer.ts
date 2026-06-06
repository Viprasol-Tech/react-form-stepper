/**
 * Pure, framework-agnostic stepper state machine.
 *
 * All transition logic lives here so it can be unit-tested in isolation,
 * independent of React. The reducer never throws and never produces an
 * out-of-range index: it clamps every transition to [0, stepCount - 1] and
 * always lands on a non-disabled step when one exists.
 */

export interface StepperState {
  /** Zero-based index of the currently active step. */
  readonly currentStep: number;
  /** Total number of steps in the wizard. Always >= 1. */
  readonly stepCount: number;
  /** Indices that participate in the flow (disabled steps excluded), sorted. */
  readonly activeIndices: readonly number[];
  /** Indices the user has visited at least once. */
  readonly visited: readonly number[];
  /** Indices the user has completed (validated successfully or passed). */
  readonly completed: readonly number[];
  /** Indices the user explicitly skipped (optional steps). */
  readonly skipped: readonly number[];
  /** Validation error messages keyed by step index. */
  readonly errors: Readonly<Record<number, string>>;
}

export type StepperAction =
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "GOTO"; step: number }
  | { type: "SKIP" }
  | { type: "COMPLETE"; step: number }
  | { type: "SET_ERROR"; step: number; message?: string }
  | { type: "SET_ACTIVE_INDICES"; indices: readonly number[] }
  | { type: "RESET" };

const uniqSorted = (xs: readonly number[]): number[] =>
  Array.from(new Set(xs)).sort((a, b) => a - b);

/**
 * Build the initial state. The starting step is clamped into range, snapped to
 * the nearest active (non-disabled) step, and a stepCount below 1 is coerced to
 * 1 so the machine always has a valid step.
 */
export function initStepperState(
  stepCount: number,
  initialStep = 0,
  activeIndices?: readonly number[]
): StepperState {
  const count = Math.max(1, Math.floor(stepCount));
  const active =
    activeIndices && activeIndices.length > 0
      ? uniqSorted(activeIndices.filter((i) => i >= 0 && i < count))
      : Array.from({ length: count }, (_, i) => i);
  const safeActive = active.length > 0 ? active : [0];
  const start = snapToActive(clampStep(initialStep, count), safeActive);
  return {
    stepCount: count,
    currentStep: start,
    activeIndices: safeActive,
    visited: [start],
    completed: [],
    skipped: [],
    errors: {},
  };
}

/** Clamp an arbitrary index into the valid range [0, stepCount - 1]. */
export function clampStep(step: number, stepCount: number): number {
  const max = Math.max(0, stepCount - 1);
  if (Number.isNaN(step)) return 0;
  return Math.min(max, Math.max(0, Math.floor(step)));
}

/** Snap an index to the nearest active index (preferring forward, then back). */
export function snapToActive(
  step: number,
  activeIndices: readonly number[]
): number {
  if (activeIndices.length === 0) return step;
  if (activeIndices.includes(step)) return step;
  const forward = activeIndices.find((i) => i > step);
  if (forward !== undefined) return forward;
  // No active step ahead; fall back to the last active before it.
  return activeIndices[activeIndices.length - 1];
}

/** The next active index after `step`, or `step` itself if none exists. */
export function nextActive(
  step: number,
  activeIndices: readonly number[]
): number {
  const found = activeIndices.find((i) => i > step);
  return found ?? step;
}

/** The previous active index before `step`, or `step` itself if none exists. */
export function prevActive(
  step: number,
  activeIndices: readonly number[]
): number {
  for (let i = activeIndices.length - 1; i >= 0; i -= 1) {
    if (activeIndices[i] < step) return activeIndices[i];
  }
  return step;
}

export function isFirstStep(state: StepperState): boolean {
  return state.currentStep <= state.activeIndices[0];
}

export function isLastStep(state: StepperState): boolean {
  const last = state.activeIndices[state.activeIndices.length - 1];
  return state.currentStep >= last;
}

/**
 * Progress through the wizard as a percentage in [0, 100], computed over the
 * *active* steps only (disabled steps don't count). Reaching the last active
 * step is treated as 100%. A single active step is always 100%.
 */
export function progressPercent(state: StepperState): number {
  const active = state.activeIndices;
  if (active.length <= 1) return 100;
  const position = active.indexOf(state.currentStep);
  const idx = position < 0 ? 0 : position;
  const ratio = (idx + 1) / active.length;
  return Math.round(ratio * 100);
}

/**
 * The pure reducer. Transitions:
 *  - NEXT: advance to the next active step, marking the current complete.
 *  - PREV: go back to the previous active step.
 *  - GOTO: jump to an arbitrary step, snapped to an active index.
 *  - SKIP: mark the current step skipped and advance.
 *  - COMPLETE: mark a step completed and clear its error.
 *  - SET_ERROR: set/clear a step's validation error message.
 *  - SET_ACTIVE_INDICES: recompute which steps participate (disabled changes).
 *  - RESET: return to the first active step and clear tracking.
 *
 * Note: validation gating (canProceed) is intentionally NOT enforced here —
 * the reducer is a pure index machine. Gating is applied by the hook/component
 * before dispatching NEXT/GOTO, which keeps this layer trivially testable.
 */
export function stepperReducer(
  state: StepperState,
  action: StepperAction
): StepperState {
  switch (action.type) {
    case "NEXT": {
      const target = nextActive(state.currentStep, state.activeIndices);
      if (target === state.currentStep) return state;
      return {
        ...state,
        currentStep: target,
        visited: uniqSorted([...state.visited, target]),
        completed: uniqSorted([...state.completed, state.currentStep]),
      };
    }
    case "PREV": {
      const target = prevActive(state.currentStep, state.activeIndices);
      if (target === state.currentStep) return state;
      return {
        ...state,
        currentStep: target,
        visited: uniqSorted([...state.visited, target]),
      };
    }
    case "GOTO": {
      const clamped = clampStep(action.step, state.stepCount);
      const target = snapToActive(clamped, state.activeIndices);
      if (target === state.currentStep) return state;
      const forward = target > state.currentStep;
      return {
        ...state,
        currentStep: target,
        visited: uniqSorted([...state.visited, target]),
        completed: forward
          ? uniqSorted([...state.completed, state.currentStep])
          : state.completed,
      };
    }
    case "SKIP": {
      const target = nextActive(state.currentStep, state.activeIndices);
      const skipped = uniqSorted([...state.skipped, state.currentStep]);
      if (target === state.currentStep) {
        return { ...state, skipped };
      }
      return {
        ...state,
        currentStep: target,
        visited: uniqSorted([...state.visited, target]),
        skipped,
      };
    }
    case "COMPLETE": {
      const { [action.step]: _removed, ...restErrors } = state.errors;
      return {
        ...state,
        completed: uniqSorted([...state.completed, action.step]),
        errors: restErrors,
      };
    }
    case "SET_ERROR": {
      if (action.message === undefined) {
        if (!(action.step in state.errors)) return state;
        const { [action.step]: _removed, ...rest } = state.errors;
        return { ...state, errors: rest };
      }
      if (state.errors[action.step] === action.message) return state;
      return {
        ...state,
        errors: { ...state.errors, [action.step]: action.message },
      };
    }
    case "SET_ACTIVE_INDICES": {
      const active = uniqSorted(
        action.indices.filter((i) => i >= 0 && i < state.stepCount)
      );
      const safeActive = active.length > 0 ? active : [0];
      const current = snapToActive(state.currentStep, safeActive);
      return {
        ...state,
        activeIndices: safeActive,
        currentStep: current,
        visited: uniqSorted([...state.visited, current]),
      };
    }
    case "RESET": {
      const start = state.activeIndices[0] ?? 0;
      return {
        ...state,
        currentStep: start,
        visited: [start],
        completed: [],
        skipped: [],
        errors: {},
      };
    }
    default: {
      // Exhaustiveness guard.
      const _never: never = action;
      return _never;
    }
  }
}
