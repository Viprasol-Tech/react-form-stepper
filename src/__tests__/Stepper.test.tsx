import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Stepper } from "../Stepper";
import type { Step } from "../types";

/**
 * A harness whose first step is invalid until a checkbox is ticked. This lets
 * us assert that Next is blocked while invalid and advances once valid.
 */
function Harness({ onComplete }: { onComplete?: () => void }) {
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

  return <Stepper steps={steps} onComplete={onComplete} />;
}

describe("<Stepper />", () => {
  it("renders the first step and a disabled Back button", () => {
    render(<Harness />);
    expect(screen.getByTestId("stepper-content")).toHaveTextContent("I agree");
    expect(screen.getByTestId("stepper-prev")).toBeDisabled();
  });

  it("blocks Next while the active step is invalid", () => {
    render(<Harness />);
    const next = screen.getByTestId("stepper-next");
    expect(next).toBeDisabled();

    // Clicking a disabled button does nothing; still on step one.
    fireEvent.click(next);
    expect(screen.getByTestId("stepper-content")).toHaveTextContent("I agree");
    expect(screen.queryByTestId("details-content")).toBeNull();
  });

  it("advances Next once the step becomes valid", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("agree"));

    const next = screen.getByTestId("stepper-next");
    expect(next).toBeEnabled();
    fireEvent.click(next);

    expect(screen.getByTestId("details-content")).toBeInTheDocument();
    expect(screen.getByTestId("stepper-prev")).toBeEnabled();
  });

  it("reports progress via the progressbar", () => {
    render(<Harness />);
    const bar = screen.getByTestId("stepper-progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "33");

    fireEvent.click(screen.getByTestId("agree"));
    fireEvent.click(screen.getByTestId("stepper-next"));
    expect(bar).toHaveAttribute("aria-valuenow", "67");
  });

  it("calls onComplete on the last step's Finish button", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    fireEvent.click(screen.getByTestId("agree"));
    fireEvent.click(screen.getByTestId("stepper-next")); // -> step 2
    fireEvent.click(screen.getByTestId("stepper-next")); // -> step 3 (last)

    const finish = screen.getByTestId("stepper-next");
    expect(finish).toHaveTextContent("Finish");
    fireEvent.click(finish);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
