import type { ReactNode } from "react";

/**
 * A single step definition. `validate` is optional; when present, it gates
 * forward navigation (Next / jumping ahead). Returning `true` means the step
 * is satisfied and the user may proceed.
 */
export interface Step {
  /** Stable identifier for the step (used as React key). */
  id: string;
  /** Human-readable label shown in the progress indicator. */
  label: string;
  /** The content rendered when this step is active. */
  content: ReactNode;
  /**
   * Optional per-step validator. Return `true` to allow advancing past this
   * step. If omitted, the step is always considered valid.
   */
  validate?: () => boolean;
}

/** Public API returned by {@link useStepper}. */
export interface StepperApi {
  /** Index of the active step. */
  currentStep: number;
  /** Total number of steps. */
  stepCount: number;
  /** True when on the first step. */
  isFirst: boolean;
  /** True when on the last step. */
  isLast: boolean;
  /** Completion percentage in [0, 100]. */
  progress: number;
  /**
   * Whether the active step's validator (if any) currently passes — i.e.
   * whether `next()` / forward `goTo()` would be permitted.
   */
  canProceed: boolean;
  /** Advance one step if validation passes and not already last. */
  next: () => void;
  /** Go back one step (no validation; never before first). */
  prev: () => void;
  /**
   * Jump to a specific step. Moving backward is always allowed; moving forward
   * requires the current step's validator to pass.
   */
  goTo: (step: number) => void;
  /** Return to the first step. */
  reset: () => void;
}
