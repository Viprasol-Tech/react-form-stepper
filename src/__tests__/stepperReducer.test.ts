import { describe, it, expect } from "vitest";
import {
  stepperReducer,
  initStepperState,
  clampStep,
  snapToActive,
  nextActive,
  prevActive,
  isFirstStep,
  isLastStep,
  progressPercent,
  type StepperState,
} from "../stepperReducer";

const make = (
  currentStep: number,
  stepCount: number,
  overrides: Partial<StepperState> = {}
): StepperState => ({
  currentStep,
  stepCount,
  activeIndices: Array.from({ length: stepCount }, (_, i) => i),
  visited: [currentStep],
  completed: [],
  skipped: [],
  errors: {},
  ...overrides,
});

describe("initStepperState", () => {
  it("clamps the initial step into range", () => {
    const s = initStepperState(3, 5);
    expect(s.currentStep).toBe(2);
    expect(s.stepCount).toBe(3);
  });

  it("clamps negative initial steps to 0", () => {
    expect(initStepperState(3, -1).currentStep).toBe(0);
  });

  it("coerces a non-positive step count to 1", () => {
    expect(initStepperState(0).stepCount).toBe(1);
    expect(initStepperState(-4).stepCount).toBe(1);
  });

  it("records the starting step as visited", () => {
    expect(initStepperState(3, 1).visited).toEqual([1]);
  });

  it("excludes disabled indices from the active set", () => {
    const s = initStepperState(4, 0, [0, 2, 3]);
    expect(s.activeIndices).toEqual([0, 2, 3]);
  });

  it("snaps the start to the nearest active step", () => {
    const s = initStepperState(4, 1, [0, 2, 3]);
    expect(s.currentStep).toBe(2);
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

describe("snapToActive / nextActive / prevActive", () => {
  it("snaps forward to the next active index", () => {
    expect(snapToActive(1, [0, 2, 4])).toBe(2);
  });

  it("snaps back when no forward active index exists", () => {
    expect(snapToActive(5, [0, 2, 4])).toBe(4);
  });

  it("returns the same index when already active", () => {
    expect(snapToActive(2, [0, 2, 4])).toBe(2);
  });

  it("finds the next/prev active index", () => {
    expect(nextActive(0, [0, 2, 4])).toBe(2);
    expect(nextActive(4, [0, 2, 4])).toBe(4);
    expect(prevActive(4, [0, 2, 4])).toBe(2);
    expect(prevActive(0, [0, 2, 4])).toBe(0);
  });
});

describe("stepperReducer NEXT", () => {
  it("advances to the next active step", () => {
    expect(stepperReducer(make(0, 3), { type: "NEXT" }).currentStep).toBe(1);
  });

  it("marks the previous step complete and the new one visited", () => {
    const r = stepperReducer(make(0, 3), { type: "NEXT" });
    expect(r.completed).toContain(0);
    expect(r.visited).toContain(1);
  });

  it("skips disabled steps when advancing", () => {
    const start = make(0, 3, { activeIndices: [0, 2] });
    expect(stepperReducer(start, { type: "NEXT" }).currentStep).toBe(2);
  });

  it("cannot advance past the last active step", () => {
    const last = make(2, 3);
    const result = stepperReducer(last, { type: "NEXT" });
    expect(result.currentStep).toBe(2);
    expect(result).toBe(last);
  });
});

describe("stepperReducer PREV", () => {
  it("goes back to the previous active step", () => {
    expect(stepperReducer(make(2, 3), { type: "PREV" }).currentStep).toBe(1);
  });

  it("skips disabled steps when going back", () => {
    const start = make(2, 3, { activeIndices: [0, 2] });
    expect(stepperReducer(start, { type: "PREV" }).currentStep).toBe(0);
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

  it("snaps to an active step when target is disabled", () => {
    const start = make(0, 5, { activeIndices: [0, 1, 3, 4] });
    expect(
      stepperReducer(start, { type: "GOTO", step: 2 }).currentStep
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

  it("completes the source step on a forward jump only", () => {
    const fwd = stepperReducer(make(0, 5), { type: "GOTO", step: 3 });
    expect(fwd.completed).toContain(0);
    const back = stepperReducer(make(3, 5), { type: "GOTO", step: 1 });
    expect(back.completed).not.toContain(3);
  });
});

describe("stepperReducer SKIP", () => {
  it("marks the current step skipped and advances", () => {
    const r = stepperReducer(make(0, 3), { type: "SKIP" });
    expect(r.skipped).toContain(0);
    expect(r.currentStep).toBe(1);
  });

  it("marks skipped even on the last step without moving", () => {
    const r = stepperReducer(make(2, 3), { type: "SKIP" });
    expect(r.skipped).toContain(2);
    expect(r.currentStep).toBe(2);
  });
});

describe("stepperReducer COMPLETE / SET_ERROR", () => {
  it("marks a step complete and clears its error", () => {
    const start = make(1, 3, { errors: { 1: "bad" } });
    const r = stepperReducer(start, { type: "COMPLETE", step: 1 });
    expect(r.completed).toContain(1);
    expect(r.errors[1]).toBeUndefined();
  });

  it("sets and clears an error message", () => {
    const withErr = stepperReducer(make(0, 3), {
      type: "SET_ERROR",
      step: 0,
      message: "Required",
    });
    expect(withErr.errors[0]).toBe("Required");
    const cleared = stepperReducer(withErr, { type: "SET_ERROR", step: 0 });
    expect(cleared.errors[0]).toBeUndefined();
  });

  it("preserves identity when clearing a non-existent error", () => {
    const s = make(0, 3);
    expect(stepperReducer(s, { type: "SET_ERROR", step: 0 })).toBe(s);
  });
});

describe("stepperReducer SET_ACTIVE_INDICES", () => {
  it("recomputes active set and snaps current onto it", () => {
    const start = make(2, 4);
    const r = stepperReducer(start, {
      type: "SET_ACTIVE_INDICES",
      indices: [0, 1, 3],
    });
    expect(r.activeIndices).toEqual([0, 1, 3]);
    expect(r.currentStep).toBe(3);
  });

  it("falls back to [0] when given an empty set", () => {
    const r = stepperReducer(make(0, 3), {
      type: "SET_ACTIVE_INDICES",
      indices: [],
    });
    expect(r.activeIndices).toEqual([0]);
  });
});

describe("stepperReducer RESET", () => {
  it("returns to the first active step and clears tracking", () => {
    const start = make(4, 5, {
      visited: [0, 1, 2, 3, 4],
      completed: [0, 1, 2, 3],
      skipped: [2],
      errors: { 3: "x" },
    });
    const r = stepperReducer(start, { type: "RESET" });
    expect(r.currentStep).toBe(0);
    expect(r.completed).toEqual([]);
    expect(r.skipped).toEqual([]);
    expect(r.errors).toEqual({});
    expect(r.visited).toEqual([0]);
  });
});

describe("boundary helpers", () => {
  it("detects first and last steps", () => {
    expect(isFirstStep(make(0, 3))).toBe(true);
    expect(isFirstStep(make(1, 3))).toBe(false);
    expect(isLastStep(make(2, 3))).toBe(true);
    expect(isLastStep(make(1, 3))).toBe(false);
  });

  it("respects the active set for boundaries", () => {
    const s = make(2, 4, { activeIndices: [1, 2, 3] });
    expect(isFirstStep({ ...s, currentStep: 1 })).toBe(true);
    expect(isLastStep({ ...s, currentStep: 3 })).toBe(true);
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

  it("computes progress over the active steps only", () => {
    const s = make(2, 4, { activeIndices: [0, 2, 3] });
    expect(progressPercent(s)).toBe(67);
  });
});
