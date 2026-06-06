import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import {
  initStepperState,
  isFirstStep,
  isLastStep,
  progressPercent,
  stepperReducer,
} from "./stepperReducer";
import type {
  Step,
  StepMeta,
  StepperApi,
  StepStatus,
  ValidationResult,
} from "./types";

export interface UseStepperOptions<TData = Record<string, unknown>> {
  /** Step at which to start (clamped + snapped to an active step). Default 0. */
  initialStep?: number;
  /** Initial form-data record, keyed by step id. */
  initialData?: TData;
  /**
   * When `true` (default), forward jumps via `goTo` require every intermediate
   * step to have been completed. When `false`, the user may navigate to any
   * already-visited step (or one step ahead) freely — non-linear mode.
   */
  linear?: boolean;
  /** Called whenever the active step index changes. */
  onStepChange?: (step: number, prev: number) => void;
  /** Called when every required step has been completed. */
  onComplete?: (data: TData) => void;
}

/** Normalize a {@link ValidationResult} into `{ valid, message }`. */
function normalize(result: ValidationResult): {
  valid: boolean;
  message?: string;
} {
  if (typeof result === "boolean") return { valid: result };
  return { valid: result.valid, message: result.message };
}

/**
 * Headless hook that drives a multi-step wizard. It wraps the pure
 * {@link stepperReducer} and layers per-step validation gating (sync or async),
 * optional/skippable steps, non-linear navigation, and form-state collection on
 * top of the raw index machine.
 */
export function useStepper<TData extends Record<string, unknown> = Record<string, unknown>>(
  steps: Step[],
  options: UseStepperOptions<TData> = {}
): StepperApi<TData> {
  const {
    initialStep = 0,
    initialData,
    linear = true,
    onStepChange,
    onComplete,
  } = options;

  // Which steps participate in the flow (disabled excluded).
  const activeIndices = useMemo(
    () =>
      steps
        .map((s, i) => (s.disabled ? -1 : i))
        .filter((i) => i >= 0),
    [steps]
  );

  const [state, dispatch] = useReducer(
    stepperReducer,
    undefined,
    () => initStepperState(steps.length, initialStep, activeIndices)
  );

  const [formData, setFormDataState] = useState<TData>(
    () => (initialData ?? ({} as TData))
  );
  const [isValidating, setIsValidating] = useState(false);
  // Cache of the last resolved validity for the active step.
  const [canProceedCache, setCanProceedCache] = useState(true);

  // Keep latest formData in a ref so async validators always see fresh data.
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const current = steps[state.currentStep];

  const runValidator = useCallback(
    async (step: Step | undefined, index: number): Promise<boolean> => {
      if (!step?.validate) {
        dispatch({ type: "SET_ERROR", step: index });
        setCanProceedCache(true);
        return true;
      }
      setIsValidating(true);
      try {
        const data = formDataRef.current[step.id as keyof TData];
        const raw = await step.validate(data);
        const { valid, message } = normalize(raw);
        dispatch({
          type: "SET_ERROR",
          step: index,
          message: valid ? undefined : message ?? "This step is incomplete.",
        });
        setCanProceedCache(valid);
        return valid;
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  const emitChange = useCallback(
    (step: number) => {
      if (step !== state.currentStep) onStepChange?.(step, state.currentStep);
    },
    [onStepChange, state.currentStep]
  );

  const next = useCallback(async (): Promise<boolean> => {
    if (isLastStep(state)) {
      const ok = await runValidator(current, state.currentStep);
      if (ok) {
        dispatch({ type: "COMPLETE", step: state.currentStep });
        onComplete?.(formDataRef.current);
      }
      return false;
    }
    const ok = await runValidator(current, state.currentStep);
    if (!ok) return false;
    const target = state.activeIndices.find((i) => i > state.currentStep);
    if (target !== undefined) emitChange(target);
    dispatch({ type: "NEXT" });
    return true;
  }, [state, current, runValidator, emitChange, onComplete]);

  const prev = useCallback(() => {
    if (isFirstStep(state)) return;
    const target = (() => {
      for (let i = state.activeIndices.length - 1; i >= 0; i -= 1) {
        if (state.activeIndices[i] < state.currentStep)
          return state.activeIndices[i];
      }
      return state.currentStep;
    })();
    emitChange(target);
    dispatch({ type: "PREV" });
  }, [state, emitChange]);

  const goTo = useCallback(
    async (step: number): Promise<boolean> => {
      const backwardOrSame = step <= state.currentStep;
      if (backwardOrSame) {
        emitChange(step);
        dispatch({ type: "GOTO", step });
        return true;
      }
      // Forward jump.
      if (linear) {
        // Must validate the current step to move forward at all.
        const ok = await runValidator(current, state.currentStep);
        if (!ok) return false;
        // In linear mode only allow jumping to the immediate next active step
        // or to an already-visited step.
        const immediateNext = state.activeIndices.find(
          (i) => i > state.currentStep
        );
        const allowed =
          step === immediateNext || state.visited.includes(step);
        if (!allowed) return false;
      } else {
        // Non-linear: allow jumping to any visited step or one step ahead
        // without forcing validation, but still validate when leaving an
        // unvalidated current step forward into the unknown.
        const immediateNext = state.activeIndices.find(
          (i) => i > state.currentStep
        );
        if (!state.visited.includes(step) && step !== immediateNext) {
          const ok = await runValidator(current, state.currentStep);
          if (!ok) return false;
        }
      }
      emitChange(step);
      dispatch({ type: "GOTO", step });
      return true;
    },
    [state, current, linear, runValidator, emitChange]
  );

  const skip = useCallback(() => {
    if (!current?.optional) return;
    if (isLastStep(state)) {
      dispatch({ type: "SKIP" });
      return;
    }
    const target = state.activeIndices.find((i) => i > state.currentStep);
    if (target !== undefined) emitChange(target);
    dispatch({ type: "SKIP" });
  }, [current, state, emitChange]);

  const reset = useCallback(() => {
    emitChange(state.activeIndices[0] ?? 0);
    dispatch({ type: "RESET" });
    setFormDataState(initialData ?? ({} as TData));
    setCanProceedCache(true);
  }, [emitChange, state.activeIndices, initialData]);

  const setStepData = useCallback(
    (data: unknown) => {
      const id = steps[state.currentStep]?.id;
      if (!id) return;
      setFormDataState((prevData) => {
        const existing = prevData[id as keyof TData];
        const merged =
          existing && typeof existing === "object" && data && typeof data === "object"
            ? { ...(existing as object), ...(data as object) }
            : data;
        return { ...prevData, [id]: merged } as TData;
      });
    },
    [steps, state.currentStep]
  );

  const setFormData = useCallback((data: TData) => {
    setFormDataState(data);
  }, []);

  const getStepData = useCallback(
    (stepId: string): unknown => formDataRef.current[stepId as keyof TData],
    []
  );

  const setError = useCallback((step: number, message?: string) => {
    dispatch({ type: "SET_ERROR", step, message });
  }, []);

  const stepMetas: StepMeta[] = useMemo(() => {
    return steps.map((step, index): StepMeta => {
      const error = state.errors[index];
      let status: StepStatus;
      if (step.disabled) status = "disabled";
      else if (error) status = "error";
      else if (state.skipped.includes(index)) status = "skipped";
      else if (index === state.currentStep) status = "current";
      else if (state.completed.includes(index)) status = "complete";
      else status = "upcoming";
      return {
        index,
        id: step.id,
        label: step.label,
        status,
        visited: state.visited.includes(index),
        optional: Boolean(step.optional),
        disabled: Boolean(step.disabled),
        error,
      };
    });
  }, [steps, state]);

  // Every required (non-optional, non-disabled) step is completed or skipped.
  const isComplete = useMemo(() => {
    return steps.every((step, index) => {
      if (step.disabled) return true;
      if (step.optional) return true;
      return state.completed.includes(index);
    });
  }, [steps, state.completed]);

  return useMemo<StepperApi<TData>>(
    () => ({
      currentStep: state.currentStep,
      stepCount: state.stepCount,
      activeStepCount: state.activeIndices.length,
      isFirst: isFirstStep(state),
      isLast: isLastStep(state),
      progress: progressPercent(state),
      canProceed: canProceedCache,
      isValidating,
      isComplete,
      visitedSteps: state.visited,
      completedSteps: state.completed,
      skippedSteps: state.skipped,
      errors: state.errors,
      steps: stepMetas,
      formData,
      next,
      prev,
      goTo,
      skip,
      reset,
      setStepData,
      setFormData,
      getStepData,
      setError,
    }),
    [
      state,
      canProceedCache,
      isValidating,
      isComplete,
      stepMetas,
      formData,
      next,
      prev,
      goTo,
      skip,
      reset,
      setStepData,
      setFormData,
      getStepData,
      setError,
    ]
  );
}
