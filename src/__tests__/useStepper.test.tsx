import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useStepper } from "../useStepper";
import type { Step } from "../types";

const basicSteps = (): Step[] => [
  { id: "a", label: "A", content: "A" },
  { id: "b", label: "B", content: "B" },
  { id: "c", label: "C", content: "C" },
];

describe("useStepper navigation", () => {
  it("starts on the first step with sensible defaults", () => {
    const { result } = renderHook(() => useStepper(basicSteps()));
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isLast).toBe(false);
    expect(result.current.activeStepCount).toBe(3);
    expect(result.current.visitedSteps).toEqual([0]);
  });

  it("advances and retreats", async () => {
    const { result } = renderHook(() => useStepper(basicSteps()));
    await act(async () => {
      await result.current.next();
    });
    expect(result.current.currentStep).toBe(1);
    act(() => result.current.prev());
    expect(result.current.currentStep).toBe(0);
  });

  it("tracks visited and completed steps", async () => {
    const { result } = renderHook(() => useStepper(basicSteps()));
    await act(async () => {
      await result.current.next();
    });
    expect(result.current.visitedSteps).toEqual([0, 1]);
    expect(result.current.completedSteps).toContain(0);
  });

  it("fires onStepChange with new and previous indices", async () => {
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useStepper(basicSteps(), { onStepChange })
    );
    await act(async () => {
      await result.current.next();
    });
    expect(onStepChange).toHaveBeenCalledWith(1, 0);
  });

  it("resets back to the start and clears tracking", async () => {
    const { result } = renderHook(() => useStepper(basicSteps()));
    await act(async () => {
      await result.current.next();
    });
    act(() => result.current.reset());
    expect(result.current.currentStep).toBe(0);
    expect(result.current.completedSteps).toEqual([]);
    expect(result.current.visitedSteps).toEqual([0]);
  });
});

describe("useStepper validation", () => {
  it("blocks next when a sync validator fails and records an error", async () => {
    const steps: Step[] = [
      {
        id: "a",
        label: "A",
        validate: () => ({ valid: false, message: "Nope" }),
        content: "A",
      },
      { id: "b", label: "B", content: "B" },
    ];
    const { result } = renderHook(() => useStepper(steps));
    let moved = true;
    await act(async () => {
      moved = await result.current.next();
    });
    expect(moved).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(result.current.errors[0]).toBe("Nope");
    expect(result.current.canProceed).toBe(false);
  });

  it("awaits async validators", async () => {
    const validate = vi.fn(
      () =>
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 5))
    );
    const steps: Step[] = [
      { id: "a", label: "A", validate, content: "A" },
      { id: "b", label: "B", content: "B" },
    ];
    const { result } = renderHook(() => useStepper(steps));
    await act(async () => {
      await result.current.next();
    });
    expect(validate).toHaveBeenCalled();
    expect(result.current.currentStep).toBe(1);
  });

  it("supplies the step's form-data slice to the validator", async () => {
    const validate = vi.fn((data: { name?: string }) =>
      Boolean(data?.name)
    );
    const steps: Step[] = [
      { id: "a", label: "A", validate, content: "A" },
      { id: "b", label: "B", content: "B" },
    ];
    const { result } = renderHook(() =>
      useStepper<{ a: { name?: string } }>(steps)
    );
    act(() => result.current.setStepData({ name: "Ada" }));
    await act(async () => {
      await result.current.next();
    });
    expect(validate).toHaveBeenCalledWith({ name: "Ada" });
    expect(result.current.currentStep).toBe(1);
  });

  it("supports imperative setError / completion via isComplete", async () => {
    const { result } = renderHook(() => useStepper(basicSteps()));
    act(() => result.current.setError(0, "manual"));
    expect(result.current.errors[0]).toBe("manual");
    act(() => result.current.setError(0));
    expect(result.current.errors[0]).toBeUndefined();
  });
});

describe("useStepper form state", () => {
  it("merges object slices and reads them back", () => {
    const { result } = renderHook(() =>
      useStepper<{ a: { x?: number; y?: number } }>(basicSteps())
    );
    act(() => result.current.setStepData({ x: 1 }));
    act(() => result.current.setStepData({ y: 2 }));
    expect(result.current.getStepData("a")).toEqual({ x: 1, y: 2 });
    expect(result.current.formData.a).toEqual({ x: 1, y: 2 });
  });

  it("replaces the whole record via setFormData", () => {
    const { result } = renderHook(() =>
      useStepper<{ a: number; b: number }>(basicSteps())
    );
    act(() => result.current.setFormData({ a: 1, b: 2 }));
    expect(result.current.formData).toEqual({ a: 1, b: 2 });
  });

  it("seeds from initialData", () => {
    const { result } = renderHook(() =>
      useStepper<{ a: string }>(basicSteps(), { initialData: { a: "seed" } })
    );
    expect(result.current.getStepData("a")).toBe("seed");
  });
});

describe("useStepper optional & disabled steps", () => {
  it("skips an optional step and records it", async () => {
    const steps: Step[] = [
      { id: "a", label: "A", optional: true, content: "A" },
      { id: "b", label: "B", content: "B" },
    ];
    const { result } = renderHook(() => useStepper(steps));
    act(() => result.current.skip());
    expect(result.current.currentStep).toBe(1);
    expect(result.current.skippedSteps).toContain(0);
  });

  it("ignores skip on a required step", () => {
    const { result } = renderHook(() => useStepper(basicSteps()));
    act(() => result.current.skip());
    expect(result.current.currentStep).toBe(0);
    expect(result.current.skippedSteps).toEqual([]);
  });

  it("excludes disabled steps from the flow and progress", async () => {
    const steps: Step[] = [
      { id: "a", label: "A", content: "A" },
      { id: "b", label: "B", disabled: true, content: "B" },
      { id: "c", label: "C", content: "C" },
    ];
    const { result } = renderHook(() => useStepper(steps));
    expect(result.current.activeStepCount).toBe(2);
    await act(async () => {
      await result.current.next();
    });
    expect(result.current.currentStep).toBe(2);
    expect(result.current.isLast).toBe(true);
  });

  it("reports isComplete once required steps are done", async () => {
    const steps: Step[] = [
      { id: "a", label: "A", content: "A" },
      { id: "b", label: "B", optional: true, content: "B" },
    ];
    const { result } = renderHook(() => useStepper(steps));
    expect(result.current.isComplete).toBe(false);
    await act(async () => {
      await result.current.next();
    });
    // Step a completed; b is optional -> required set satisfied.
    expect(result.current.isComplete).toBe(true);
  });
});

describe("useStepper goTo gating", () => {
  it("allows backward jumps unconditionally", async () => {
    const { result } = renderHook(() => useStepper(basicSteps()));
    await act(async () => {
      await result.current.next();
    });
    let ok = false;
    await act(async () => {
      ok = await result.current.goTo(0);
    });
    expect(ok).toBe(true);
    expect(result.current.currentStep).toBe(0);
  });

  it("blocks a forward linear jump past unvisited steps when invalid", async () => {
    const steps: Step[] = [
      { id: "a", label: "A", validate: () => false, content: "A" },
      { id: "b", label: "B", content: "B" },
      { id: "c", label: "C", content: "C" },
    ];
    const { result } = renderHook(() => useStepper(steps, { linear: true }));
    let ok = true;
    await act(async () => {
      ok = await result.current.goTo(2);
    });
    expect(ok).toBe(false);
    expect(result.current.currentStep).toBe(0);
  });

  it("permits a non-linear forward jump to an adjacent step", async () => {
    const { result } = renderHook(() =>
      useStepper(basicSteps(), { linear: false })
    );
    let ok = false;
    await act(async () => {
      ok = await result.current.goTo(1);
    });
    expect(ok).toBe(true);
    expect(result.current.currentStep).toBe(1);
  });
});

describe("useStepper step metadata", () => {
  it("exposes per-step meta with status and flags", () => {
    const steps: Step[] = [
      { id: "a", label: "A", content: "A" },
      { id: "b", label: "B", optional: true, content: "B" },
      { id: "c", label: "C", disabled: true, content: "C" },
    ];
    const { result } = renderHook(() => useStepper(steps));
    const metas = result.current.steps;
    expect(metas[0].status).toBe("current");
    expect(metas[1].optional).toBe(true);
    expect(metas[2].status).toBe("disabled");
    expect(metas[2].disabled).toBe(true);
  });
});
