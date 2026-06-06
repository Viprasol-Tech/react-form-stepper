import { describe, it, expect } from "vitest";
import {
  stepperReducer,
  initStepperState,
  clampStep,
  isFirstStep,
  isLastStep,
  progressPercent,
  type StepperState,
} from "../stepperReducer";

const make = (currentStep: number, stepCount: number): StepperState => ({
  currentStep,
  stepCount,
});

describe("initStepperState", () => {
  it("clamps the initial step into range", () => {
    expect(initStepperState(3, 5)).toEqual({ currentStep: 2, stepCount: 3 });
    expect(initStepperState(3, -1)).toEqual({ currentStep: 0, stepCount: 3 });
  });

  it("coerces a non-positive step count to 1", () => {
    expect(initStepperState(0)).toEqual({ currentStep: 0, stepCount: 1 });
    expect(initStepperState(-4)).toEqual({ currentStep: 0, stepCount: 1 });
  });
});

describe("clampStep", () => {
  it("bounds values to [0, stepCount - 1]", () => {
    expect(clampStep(-2, 4)).toBe(0);
    expect(clampStep(10, 4)).toBe(3);
    expect(clampStep(2, 4)).toBe(2);
  });

  it("handles NaN by returning 0", () => {
    expect(clampStep(NaN, 4)).toBe(0);
  });
});

describe("stepperReducer NEXT", () => {
  it("advances one step", () => {
    expect(stepperReducer(make(0, 3), { type: "NEXT" }).currentStep).toBe(1);
  });

  it("cannot advance past the last step", () => {
    const last = make(2, 3);
    const result = stepperReducer(last, { type: "NEXT" });
    expect(result.currentStep).toBe(2);
    // Identity preserved when no change occurs.
    expect(result).toBe(last);
  });
});

describe("stepperReducer PREV", () => {
  it("goes back one step", () => {
    expect(stepperReducer(make(2, 3), { type: "PREV" }).currentStep).toBe(1);
  });

  it("cannot go before the first step", () => {
    const first = make(0, 3);
    const result = stepperReducer(first, { type: "PREV" });
    expect(result.currentStep).toBe(0);
    expect(result).toBe(first);
  });
});

describe("stepperReducer GOTO", () => {
  it("jumps to a valid step", () => {
    expect(
      stepperReducer(make(0, 5), { type: "GOTO", step: 3 }).currentStep
    ).toBe(3);
  });

  it("clamps out-of-range targets", () => {
    expect(
      stepperReducer(make(0, 5), { type: "GOTO", step: 99 }).currentStep
    ).toBe(4);
    expect(
      stepperReducer(make(2, 5), { type: "GOTO", step: -3 }).currentStep
    ).toBe(0);
  });
});

describe("stepperReducer RESET", () => {
  it("returns to the first step", () => {
    expect(stepperReducer(make(4, 5), { type: "RESET" }).currentStep).toBe(0);
  });
});

describe("boundary helpers", () => {
  it("detects first and last steps", () => {
    expect(isFirstStep(make(0, 3))).toBe(true);
    expect(isFirstStep(make(1, 3))).toBe(false);
    expect(isLastStep(make(2, 3))).toBe(true);
    expect(isLastStep(make(1, 3))).toBe(false);
  });
});

describe("progressPercent", () => {
  it("is 100 for a single-step wizard", () => {
    expect(progressPercent(make(0, 1))).toBe(100);
  });

  it("reports proportional progress", () => {
    expect(progressPercent(make(0, 4))).toBe(25);
    expect(progressPercent(make(1, 4))).toBe(50);
    expect(progressPercent(make(3, 4))).toBe(100);
  });
});
