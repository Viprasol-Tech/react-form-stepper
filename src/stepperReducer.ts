/**
 * Pure, framework-agnostic stepper state machine.
 *
 * All transition logic lives here so it can be unit-tested in isolation,
 * independent of React. The reducer never throws and never produces an
 * out-of-range index: it clamps every transition to [0, stepCount - 1].
 */

export interface StepperState {
  /** Zero-based index of the currently active step. */
  readonly currentStep: number;
  /** Total number of steps in the wizard. Always >= 1. */
  readonly stepCount: number;
}

export type StepperAction =
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "GOTO"; step: number }
  | { type: "RESET" };

/**
 * Build the initial state. The starting step is clamped into range and a
 * stepCount below 1 is coerced to 1 so the machine always has a valid step.
 */
export function initStepperState(
  stepCount: number,
  initialStep = 0
): StepperState {
  const count = Math.max(1, Math.floor(stepCount));
  return {
    stepCount: count,
    currentStep: clampStep(initialStep, count),
  };
}

/** Clamp an arbitrary index into the valid range [0, stepCount - 1]. */
export function clampStep(step: number, stepCount: number): number {
  const max = Math.max(0, stepCount - 1);
  if (Number.isNaN(step)) return 0;
  return Math.min(max, Math.max(0, Math.floor(step)));
}

export function isFirstStep(state: StepperState): boolean {
  return state.currentStep <= 0;
}

export function isLastStep(state: StepperState): boolean {
  return state.currentStep >= state.stepCount - 1;
}

/**
 * Progress through the wizard as a percentage in [0, 100].
 *
 * Reaching the last step is treated as 100% complete; the first step of an
 * N-step wizard reports (1 / N) * 100 so progress is non-zero from the start.
 * A single-step wizard is always 100%.
 */
export function progressPercent(state: StepperState): number {
  if (state.stepCount <= 1) return 100;
  const ratio = (state.currentStep + 1) / state.stepCount;
  return Math.round(ratio * 100);
}

/**
 * The pure reducer. Transitions:
 *  - NEXT: advance one step, but never past the last step.
 *  - PREV: go back one step, but never before the first step.
 *  - GOTO: jump to an arbitrary step, clamped into range.
 *  - RESET: return to the first step.
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
      const next = clampStep(state.currentStep + 1, state.stepCount);
      return next === state.currentStep ? state : { ...state, currentStep: next };
    }
    case "PREV": {
      const prev = clampStep(state.currentStep - 1, state.stepCount);
      return prev === state.currentStep ? state : { ...state, currentStep: prev };
    }
    case "GOTO": {
      const target = clampStep(action.step, state.stepCount);
      return target === state.currentStep
        ? state
        : { ...state, currentStep: target };
    }
    case "RESET": {
      return state.currentStep === 0 ? state : { ...state, currentStep: 0 };
    }
    default: {
      // Exhaustiveness guard.
      const _never: never = action;
      return _never;
    }
  }
}
