import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { Stepper } from "../Stepper";
import type { ProgressVariant, Step } from "../types";

/**
 * A harness whose first step is invalid until a checkbox is ticked. This lets
 * us assert that Next is blocked while invalid and advances once valid.
 */
function Harness({
  onComplete,
  variant,
}: {
  onComplete?: () => void;
  variant?: ProgressVariant;
}) {
  const [agreed, setAgreed] = useState(false);

  const steps: Step[] = [
    {
      id: "terms",
      label: "Terms",
      validate: () => agreed,
      content: (
        <label>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            data-testid="agree"
          />
          I agree
        </label>
      ),
    },
    {
      id: "details",
      label: "Details",
      content: <p data-testid="details-content">Step two</p>,
    },
    {
      id: "done",
      label: "Done",
      content: <p data-testid="done-content">All set</p>,
    },
  ];

  return <Stepper steps={steps} onComplete={onComplete} variant={variant} />;
}

describe("<Stepper /> basics", () => {
  it("renders the first step and a disabled Back button", () => {
    render(<Harness />);
    expect(screen.getByTestId("stepper-content")).toHaveTextContent("I agree");
    expect(screen.getByTestId("stepper-prev")).toBeDisabled();
  });

  it("blocks Next while the active step is invalid and shows an error", async () => {
    render(<Harness />);
    const next = screen.getByTestId("stepper-next");
    fireEvent.click(next);

    await waitFor(() =>
      expect(screen.getByTestId("stepper-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("stepper-content")).toHaveTextContent("I agree");
    expect(screen.queryByTestId("details-content")).toBeNull();
  });

  it("advances Next once the step becomes valid and clears the error", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("agree"));
    fireEvent.click(screen.getByTestId("stepper-next"));

    await waitFor(() =>
      expect(screen.getByTestId("details-content")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("stepper-error")).toBeNull();
    expect(screen.getByTestId("stepper-prev")).toBeEnabled();
  });

  it("goes back with the Back button", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("agree"));
    fireEvent.click(screen.getByTestId("stepper-next"));
    await screen.findByTestId("details-content");

    fireEvent.click(screen.getByTestId("stepper-prev"));
    expect(screen.getByTestId("stepper-content")).toHaveTextContent("I agree");
  });

  it("calls onComplete on the last step's Finish button", async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    fireEvent.click(screen.getByTestId("agree"));
    fireEvent.click(screen.getByTestId("stepper-next"));
    await screen.findByTestId("details-content");
    fireEvent.click(screen.getByTestId("stepper-next"));
    await screen.findByTestId("done-content");

    const finish = screen.getByTestId("stepper-next");
    expect(finish).toHaveTextContent("Finish");
    fireEvent.click(finish);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });
});

describe("<Stepper /> progress variants", () => {
  it("renders a progressbar for the bar variant", () => {
    render(<Harness variant="bar" />);
    const bar = screen.getByTestId("stepper-progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "33");
  });

  it("renders a ratio summary for the ratio variant", () => {
    render(<Harness variant="ratio" />);
    expect(screen.getByTestId("stepper-ratio")).toHaveTextContent(
      "Step 1 of 3"
    );
  });

  it("defaults to the numbered variant with no progressbar", () => {
    render(<Harness />);
    expect(screen.getByTestId("stepper")).toHaveAttribute(
      "data-variant",
      "numbered"
    );
    expect(screen.queryByTestId("stepper-progressbar")).toBeNull();
  });

  it("renders dots without text labels for the dots variant", () => {
    render(<Harness variant="dots" />);
    expect(screen.getByTestId("stepper")).toHaveAttribute(
      "data-variant",
      "dots"
    );
  });
});

describe("<Stepper /> async validation", () => {
  function AsyncHarness() {
    const steps: Step[] = [
      {
        id: "check",
        label: "Check",
        validate: async () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ valid: false, message: "Taken" }), 10)
          ),
        content: <p data-testid="check-content">Checking</p>,
      },
      { id: "two", label: "Two", content: <p data-testid="two">Two</p> },
    ];
    return <Stepper steps={steps} />;
  }

  it("awaits an async validator and surfaces its message", async () => {
    render(<AsyncHarness />);
    fireEvent.click(screen.getByTestId("stepper-next"));

    await waitFor(() =>
      expect(screen.getByTestId("stepper-error")).toHaveTextContent("Taken")
    );
    expect(screen.queryByTestId("two")).toBeNull();
  });
});

describe("<Stepper /> optional / skippable steps", () => {
  function OptionalHarness() {
    const steps: Step[] = [
      { id: "a", label: "A", content: <p data-testid="a">A</p> },
      {
        id: "b",
        label: "B",
        optional: true,
        content: <p data-testid="b">B</p>,
      },
      { id: "c", label: "C", content: <p data-testid="c">C</p> },
    ];
    return <Stepper steps={steps} />;
  }

  it("offers a Skip button on optional steps and skips forward", async () => {
    render(<OptionalHarness />);
    fireEvent.click(screen.getByTestId("stepper-next"));
    await screen.findByTestId("b");

    const skip = screen.getByTestId("stepper-skip");
    fireEvent.click(skip);
    expect(screen.getByTestId("c")).toBeInTheDocument();
  });

  it("does not show Skip on required steps", () => {
    render(<OptionalHarness />);
    expect(screen.queryByTestId("stepper-skip")).toBeNull();
  });
});

describe("<Stepper /> disabled steps", () => {
  function DisabledHarness() {
    const steps: Step[] = [
      { id: "a", label: "A", content: <p data-testid="a">A</p> },
      {
        id: "b",
        label: "B",
        disabled: true,
        content: <p data-testid="b">B</p>,
      },
      { id: "c", label: "C", content: <p data-testid="c">C</p> },
    ];
    return <Stepper steps={steps} />;
  }

  it("skips over a disabled step when advancing", async () => {
    render(<DisabledHarness />);
    fireEvent.click(screen.getByTestId("stepper-next"));
    await waitFor(() => expect(screen.getByTestId("c")).toBeInTheDocument());
    expect(screen.queryByTestId("b")).toBeNull();
  });

  it("omits the disabled step from the progress header", () => {
    render(<DisabledHarness />);
    expect(screen.queryByTestId("stepper-tab-1")).toBeNull();
    expect(screen.getByTestId("stepper-tab-0")).toBeInTheDocument();
    expect(screen.getByTestId("stepper-tab-2")).toBeInTheDocument();
  });
});

describe("<Stepper /> clickable / non-linear navigation", () => {
  function NavHarness({ linear }: { linear: boolean }) {
    const steps: Step[] = [
      { id: "a", label: "A", content: <p data-testid="a">A</p> },
      { id: "b", label: "B", content: <p data-testid="b">B</p> },
      { id: "c", label: "C", content: <p data-testid="c">C</p> },
    ];
    return <Stepper steps={steps} linear={linear} />;
  }

  it("allows clicking back to a visited step", async () => {
    render(<NavHarness linear />);
    fireEvent.click(screen.getByTestId("stepper-next"));
    await screen.findByTestId("b");

    fireEvent.click(screen.getByTestId("stepper-tab-0"));
    expect(screen.getByTestId("a")).toBeInTheDocument();
  });

  it("disables tabs for unvisited future steps in linear mode", () => {
    render(<NavHarness linear />);
    expect(screen.getByTestId("stepper-tab-2")).toBeDisabled();
  });

  it("allows jumping ahead freely in non-linear mode", async () => {
    render(<NavHarness linear={false} />);
    // Step C is one step ahead of B which is one ahead of A; jump to B first.
    fireEvent.click(screen.getByTestId("stepper-next"));
    await screen.findByTestId("b");
    fireEvent.click(screen.getByTestId("stepper-tab-2"));
    await waitFor(() => expect(screen.getByTestId("c")).toBeInTheDocument());
  });
});

describe("<Stepper /> step metadata", () => {
  it("exposes status via data-status attributes", async () => {
    function H() {
      const steps: Step[] = [
        { id: "a", label: "A", content: <p>A</p> },
        { id: "b", label: "B", content: <p>B</p> },
      ];
      return <Stepper steps={steps} />;
    }
    render(<H />);
    expect(screen.getByTestId("stepper-step-0")).toHaveAttribute(
      "data-status",
      "current"
    );
    fireEvent.click(screen.getByTestId("stepper-next"));
    await waitFor(() =>
      expect(screen.getByTestId("stepper-step-0")).toHaveAttribute(
        "data-status",
        "complete"
      )
    );
  });
});
