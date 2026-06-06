import type { ReactNode } from "react";
import { useStepper } from "./useStepper";
import type { Step, StepperApi } from "./types";

export interface StepperLabels {
  next?: string;
  prev?: string;
  finish?: string;
}

export interface StepperProps {
  /** Ordered list of steps to render. */
  steps: Step[];
  /** Step to start on (clamped into range). */
  initialStep?: number;
  /** Fired when the active step index changes. */
  onStepChange?: (step: number) => void;
  /** Fired when the user clicks Finish on the last (valid) step. */
  onComplete?: () => void;
  /** Override the default control button labels. */
  labels?: StepperLabels;
  /** Optional custom footer render-prop; receives the full stepper API. */
  renderFooter?: (api: StepperApi) => ReactNode;
  /** Optional class name applied to the root element. */
  className?: string;
}

const DEFAULT_LABELS: Required<StepperLabels> = {
  next: "Next",
  prev: "Back",
  finish: "Finish",
};

/**
 * A multi-step form wizard. Renders a progress header, the active step's
 * content, and Back / Next (or Finish) controls. Forward navigation is gated
 * by the active step's optional `validate()` function.
 */
export function Stepper({
  steps,
  initialStep,
  onStepChange,
  onComplete,
  labels,
  renderFooter,
  className,
}: StepperProps): JSX.Element {
  const api = useStepper(steps, { initialStep, onStepChange });
  const resolved = { ...DEFAULT_LABELS, ...labels };
  const active = steps[api.currentStep];

  const handleNext = (): void => {
    if (api.isLast) {
      if (api.canProceed) onComplete?.();
      return;
    }
    api.next();
  };

  return (
    <div className={className} data-testid="stepper">
      <ol
        role="list"
        aria-label="Progress"
        data-testid="stepper-progress"
        style={{ display: "flex", gap: 8, listStyle: "none", padding: 0 }}
      >
        {steps.map((step, index) => {
          const status =
            index < api.currentStep
              ? "complete"
              : index === api.currentStep
                ? "current"
                : "upcoming";
          return (
            <li
              key={step.id}
              data-status={status}
              aria-current={status === "current" ? "step" : undefined}
            >
              {index + 1}. {step.label}
            </li>
          );
        })}
      </ol>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={api.progress}
        data-testid="stepper-progressbar"
      >
        <span style={{ display: "block", width: `${api.progress}%` }} />
      </div>

      <section data-testid="stepper-content" aria-live="polite">
        {active?.content}
      </section>

      {renderFooter ? (
        renderFooter(api)
      ) : (
        <div data-testid="stepper-controls" style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={api.prev}
            disabled={api.isFirst}
            data-testid="stepper-prev"
          >
            {resolved.prev}
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!api.canProceed}
            data-testid="stepper-next"
          >
            {api.isLast ? resolved.finish : resolved.next}
          </button>
        </div>
      )}
    </div>
  );
}
