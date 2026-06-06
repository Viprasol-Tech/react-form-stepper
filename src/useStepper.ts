import { useCallback, useMemo, useReducer } from "react";
import {
  initStepperState,
  isFirstStep,
  isLastStep,
  progressPercent,
  stepperReducer,
} from "./stepperReducer";
import type { Step, StepperApi } from "./types";

export interface UseStepperOptions {
  /** Step at which to start (clamped into range). Defaults to 0. */
  initialStep?: number;
  /** Called whenever the active step index changes. */
  onStepChange?: (step: number) => void;
}

/**
 * Headless hook that drives a multi-step wizard. It wraps the pure
 * {@link stepperReducer} and layers per-step validation gating on top of the
 * raw index machine.
 */
export function useStepper(
  steps: Step[],
  options: UseStepperOptions = {}
): StepperApi {
  const { initialStep = 0, onStepChange } = options;

  const [state, dispatch] = useReducer(
    stepperReducer,
    undefined,
    () => initStepperState(steps.length, initialStep)
  );

  const current = steps[state.currentStep];
  // A step with no validator is always passable.
  const canProceed = current?.validate ? current.validate() : true;

  const emitChange = useCallback(
    (step: number) => {
      if (step !== state.currentStep) onStepChange?.(step);
    },
    [onStepChange, state.currentStep]
  );

  const next = useCallback(() => {
    if (isLastStep(state)) return;
    if (!canProceed) return;
    emitChange(state.currentStep + 1);
    dispatch({ type: "NEXT" });
  }, [state, canProceed, emitChange]);

  const prev = useCallback(() => {
    if (isFirstStep(state)) return;
    emitChange(state.currentStep - 1);
    dispatch({ type: "PREV" });
  }, [state, emitChange]);

  const goTo = useCallback(
    (step: number) => {
      // Backward (or same) jumps are unconditional; forward jumps require the
      // current step to validate.
      if (step > state.currentStep && !canProceed) return;
      emitChange(step);
      dispatch({ type: "GOTO", step });
    },
    [state.currentStep, canProceed, emitChange]
  );

  const reset = useCallback(() => {
    emitChange(0);
    dispatch({ type: "RESET" });
  }, [emitChange]);

  return useMemo<StepperApi>(
    () => ({
      currentStep: state.currentStep,
      stepCount: state.stepCount,
      isFirst: isFirstStep(state),
      isLast: isLastStep(state),
      progress: progressPercent(state),
      canProceed,
      next,
      prev,
      goTo,
      reset,
    }),
    [state, canProceed, next, prev, goTo, reset]
  );
}
