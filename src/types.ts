import type { ReactNode } from "react";

/**
 * The result of running a step validator.
 *
 * - `true` / `false` is the simplest form: the step is satisfied or not.
 * - An object form lets you return a human-readable error message alongside
 *   the boolean, which the component surfaces and the hook exposes via
 *   {@link StepperApi.errors}.
 */
export type ValidationResult =
  | boolean
  | { valid: boolean; message?: string };

/**
 * Per-step validator. May be synchronous or asynchronous.
 *
 * The validator receives the data collected for the step so far (see
 * {@link Step.id} and the form-state APIs on {@link StepperApi}) and should
 * return whether the user may advance. Async validators (e.g. server-side
 * uniqueness checks) are awaited; while one is in flight the stepper reports
 * {@link StepperApi.isValidating}.
 */
export type StepValidator<TData = unknown> = (
  data: TData
) => ValidationResult | Promise<ValidationResult>;

/**
 * A single step definition.
 */
export interface Step<TData = unknown> {
  /** Stable identifier for the step (used as React key and form-state key). */
  id: string;
  /** Human-readable label shown in the progress indicator. */
  label: string;
  /** Optional sub-label / description rendered beneath the label. */
  description?: string;
  /** The content rendered when this step is active. */
  content: ReactNode;
  /**
   * Optional per-step validator. Return a truthy result to allow advancing
   * past this step. If omitted, the step is always considered valid. May be
   * async; see {@link StepValidator}.
   */
  validate?: StepValidator<TData>;
  /**
   * When `true`, the step may be skipped without satisfying its validator. A
   * "Skip" affordance is offered and {@link StepperApi.skip} becomes a no-op
   * for non-optional steps.
   */
  optional?: boolean;
  /**
   * When `true`, the step is removed from the active flow entirely: it is not
   * rendered, not counted in progress, and navigation steps over it. Useful
   * for conditionally-shown steps driven by earlier answers.
   */
  disabled?: boolean;
  /** Optional icon node rendered in the progress indicator. */
  icon?: ReactNode;
}

/** Lifecycle status of a step within the wizard. */
export type StepStatus =
  | "complete"
  | "current"
  | "upcoming"
  | "skipped"
  | "error"
  | "disabled";

/** Visual style of the progress indicator. */
export type ProgressVariant = "bar" | "dots" | "numbered" | "ratio";

/** Per-step metadata exposed to consumers for custom rendering. */
export interface StepMeta {
  /** The step's index in the original `steps` array. */
  index: number;
  /** The step's stable id. */
  id: string;
  /** The step's human-readable label. */
  label: string;
  /** Current lifecycle status. */
  status: StepStatus;
  /** Whether this step has been visited at least once. */
  visited: boolean;
  /** Whether this step is marked optional. */
  optional: boolean;
  /** Whether this step is currently disabled (excluded from the flow). */
  disabled: boolean;
  /** Current validation error message for this step, if any. */
  error?: string;
}

/** Public API returned by {@link useStepper}. */
export interface StepperApi<TData = Record<string, unknown>> {
  /** Index of the active step (into the original `steps` array). */
  currentStep: number;
  /** Total number of steps (including disabled ones). */
  stepCount: number;
  /** Number of steps that participate in the flow (excludes disabled). */
  activeStepCount: number;
  /** True when on the first active step. */
  isFirst: boolean;
  /** True when on the last active step. */
  isLast: boolean;
  /** Completion percentage in [0, 100]. */
  progress: number;
  /**
   * Whether the active step's validator currently passes the *cached* result
   * (i.e. whether `next()` last evaluated to passable). For async validators
   * this reflects the most recent resolution, not an in-flight run.
   */
  canProceed: boolean;
  /** True while an async validator for the active step is running. */
  isValidating: boolean;
  /** True once every required step has been completed. */
  isComplete: boolean;
  /** The set of step indices that have been visited at least once. */
  visitedSteps: readonly number[];
  /** The set of step indices that have been completed (validated/passed). */
  completedSteps: readonly number[];
  /** The set of step indices that were skipped. */
  skippedSteps: readonly number[];
  /** Validation error messages keyed by step index. */
  errors: Readonly<Record<number, string>>;
  /** Per-step metadata for rendering custom indicators. */
  steps: readonly StepMeta[];
  /** The accumulated form data, keyed by step id. */
  formData: TData;
  /**
   * Advance one step if validation passes and not already last. Returns a
   * promise that resolves to whether the advance happened (async-validator
   * aware).
   */
  next: () => Promise<boolean>;
  /** Go back one active step (no validation; never before first). */
  prev: () => void;
  /**
   * Jump to a specific step. Backward / same jumps are unconditional. Forward
   * jumps validate the current step first (unless the target has already been
   * visited and `linear` is disabled). Returns whether the jump happened.
   */
  goTo: (step: number) => Promise<boolean>;
  /** Skip the active step if it is optional; otherwise a no-op. */
  skip: () => void;
  /** Return to the first step and clear visited/completed/error tracking. */
  reset: () => void;
  /** Merge a partial value into the active step's slice of form data. */
  setStepData: (data: Partial<TData[keyof TData]> | unknown) => void;
  /** Replace the entire form-data record. */
  setFormData: (data: TData) => void;
  /** Read the data slice for a given step id (typed loosely). */
  getStepData: (stepId: string) => unknown;
  /** Imperatively set or clear the error message for a step index. */
  setError: (step: number, message?: string) => void;
}
