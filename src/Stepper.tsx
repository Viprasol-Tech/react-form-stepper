import type { ReactNode } from "react";
import { useStepper } from "./useStepper";
import type { ProgressVariant, Step, StepperApi } from "./types";

export interface StepperLabels {
  next?: string;
  prev?: string;
  finish?: string;
  skip?: string;
}

export interface StepperProps<TData extends Record<string, unknown> = Record<string, unknown>> {
  /** Ordered list of steps to render. */
  steps: Step[];
  /** Step to start on (clamped + snapped to an active step). */
  initialStep?: number;
  /** Initial form-data record, keyed by step id. */
  initialData?: TData;
  /**
   * Linear mode (default) requires steps be completed in order. Disable for
   * free non-linear navigation between visited steps.
   */
  linear?: boolean;
  /** Visual style of the progress indicator. Defaults to `"numbered"`. */
  variant?: ProgressVariant;
  /**
   * When `true`, clicking a step header navigates to it (subject to linear
   * rules). Defaults to `true`.
   */
  clickableSteps?: boolean;
  /** Fired when the active step index changes. */
  onStepChange?: (step: number, prev: number) => void;
  /** Fired when the user completes the last (valid) step. */
  onComplete?: (data: TData) => void;
  /** Override the default control button labels. */
  labels?: StepperLabels;
  /** Optional custom footer render-prop; receives the full stepper API. */
  renderFooter?: (api: StepperApi<TData>) => ReactNode;
  /** Optional custom step-content render-prop. */
  renderStep?: (step: Step, api: StepperApi<TData>) => ReactNode;
  /** Optional class name applied to the root element. */
  className?: string;
}

const DEFAULT_LABELS: Required<StepperLabels> = {
  next: "Next",
  prev: "Back",
  finish: "Finish",
  skip: "Skip",
};

/**
 * A multi-step form wizard. Renders an accessible progress header (in one of
 * four visual variants), the active step's content, an inline validation error,
 * and Back / Skip / Next (or Finish) controls. Forward navigation is gated by
 * the active step's optional sync-or-async `validate()` function.
 */
export function Stepper<TData extends Record<string, unknown> = Record<string, unknown>>({
  steps,
  initialStep,
  initialData,
  linear = true,
  variant = "numbered",
  clickableSteps = true,
  onStepChange,
  onComplete,
  labels,
  renderFooter,
  renderStep,
  className,
}: StepperProps<TData>): JSX.Element {
  const api = useStepper<TData>(steps, {
    initialStep,
    initialData,
    linear,
    onStepChange,
    onComplete,
  });
  const resolved = { ...DEFAULT_LABELS, ...labels };
  const active = steps[api.currentStep];
  const activeError = api.errors[api.currentStep];

  const handleNext = (): void => {
    void api.next();
  };

  const handleStepClick = (index: number): void => {
    if (!clickableSteps) return;
    void api.goTo(index);
  };

  // The next active step ahead of the current one (used to permit clicking
  // one step forward in non-linear mode).
  const immediateNext = api.steps.find(
    (m) => !m.disabled && m.index > api.currentStep
  )?.index;

  return (
    <div className={className} data-testid="stepper" data-variant={variant}>
      {variant === "ratio" ? (
        <p data-testid="stepper-ratio" aria-label="Progress">
          Step {api.steps.filter((s) => !s.disabled).findIndex((s) => s.index === api.currentStep) + 1}{" "}
          of {api.activeStepCount}
        </p>
      ) : (
        <ol
          role="list"
          aria-label="Progress"
          data-testid="stepper-progress"
          style={{ display: "flex", gap: 8, listStyle: "none", padding: 0 }}
        >
          {api.steps
            .filter((meta) => !meta.disabled)
            .map((meta) => {
              const isClickable =
                clickableSteps &&
                (meta.visited ||
                  meta.status === "current" ||
                  (!linear && meta.index === immediateNext));
              const label =
                variant === "dots" ? "" : `${meta.index + 1}. ${meta.label}`;
              return (
                <li
                  key={meta.id}
                  data-status={meta.status}
                  data-testid={`stepper-step-${meta.index}`}
                  aria-current={meta.status === "current" ? "step" : undefined}
                >
                  <button
                    type="button"
                    onClick={() => handleStepClick(meta.index)}
                    disabled={!isClickable}
                    aria-label={`${meta.label}${meta.optional ? " (optional)" : ""}`}
                    data-testid={`stepper-tab-${meta.index}`}
                    style={{
                      cursor: isClickable ? "pointer" : "default",
                      background: "none",
                      border: "none",
                      padding: 0,
                      font: "inherit",
                    }}
                  >
                    {variant === "dots" ? <span aria-hidden="true">●</span> : label}
                    {meta.optional && variant !== "dots" ? " (optional)" : null}
                  </button>
                </li>
              );
            })}
        </ol>
      )}

      {variant === "bar" || variant === "ratio" ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={api.progress}
          aria-busy={api.isValidating}
          data-testid="stepper-progressbar"
        >
          <span style={{ display: "block", width: `${api.progress}%` }} />
        </div>
      ) : null}

      <section
        data-testid="stepper-content"
        aria-live="polite"
        aria-busy={api.isValidating}
      >
        {renderStep && active ? renderStep(active, api) : active?.content}
      </section>

      {activeError ? (
        <p role="alert" data-testid="stepper-error" style={{ color: "#b00020" }}>
          {activeError}
        </p>
      ) : null}

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
          {active?.optional && !api.isLast ? (
            <button
              type="button"
              onClick={api.skip}
              data-testid="stepper-skip"
            >
              {resolved.skip}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleNext}
            disabled={api.isValidating}
            aria-busy={api.isValidating}
            data-testid="stepper-next"
          >
            {api.isLast ? resolved.finish : resolved.next}
          </button>
        </div>
      )}
    </div>
  );
}
