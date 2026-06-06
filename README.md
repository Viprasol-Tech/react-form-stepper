<div align="center">
  <img src="docs/assets/logo.png" alt="Viprasol Tech" width="120" />

  <h1>react-form-stepper</h1>

  <p><strong>Multi-step form wizard component for React with validation per step.</strong></p>

  <p>Built and maintained by <a href="https://viprasol.com">Viprasol Tech</a></p>

  <p>
    <a href="https://github.com/Viprasol-Tech/react-form-stepper/actions"><img src="https://github.com/Viprasol-Tech/react-form-stepper/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT" /></a>
    <a href="https://www.npmjs.com/package/react-form-stepper"><img src="https://img.shields.io/npm/v/react-form-stepper.svg" alt="npm version" /></a>
    <img src="https://img.shields.io/badge/TypeScript-strict-blue.svg" alt="TypeScript strict" />
  </p>
</div>

---

## Features

- **Headless `useStepper` hook** — drive your own UI with `next` / `prev` / `goTo` / `reset`, `progress`, `canProceed`, `isFirst`, `isLast`.
- **Per-step validation** — supply a `validate()` per step; forward navigation is blocked until it returns `true`. Backward navigation is always allowed.
- **Pure, tested state machine** — the transition logic is a framework-agnostic reducer that clamps every move into range (never past the last step, never before the first).
- **Drop-in `<Stepper />` component** — progress header, content area, and Back / Next (or Finish) controls out of the box, with accessible `role="progressbar"` and `aria-current` markup.
- **Customizable** — override button labels or replace the footer entirely with a render-prop that receives the full stepper API.
- **TypeScript strict, zero runtime dependencies.**

## Install

```bash
npm i react-form-stepper
```

`react` and `react-dom` (>= 18) are peer dependencies.

## Usage

```tsx
import { useState } from "react";
import { Stepper, type Step } from "react-form-stepper";

export function SignupWizard() {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("");

  const steps: Step[] = [
    {
      id: "account",
      label: "Account",
      validate: () => /\S+@\S+\.\S+/.test(email),
      content: (
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      ),
    },
    {
      id: "plan",
      label: "Plan",
      validate: () => plan !== "",
      content: (
        <select value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">Choose a plan…</option>
          <option value="pro">Pro</option>
          <option value="team">Team</option>
        </select>
      ),
    },
    {
      id: "review",
      label: "Review",
      content: <p>Submitting {email} on the {plan} plan.</p>,
    },
  ];

  return <Stepper steps={steps} onComplete={() => console.log("done!")} />;
}
```

### Headless usage with `useStepper`

```tsx
import { useStepper, type Step } from "react-form-stepper";

function Custom({ steps }: { steps: Step[] }) {
  const { currentStep, progress, canProceed, next, prev, isLast } =
    useStepper(steps);

  return (
    <>
      <progress value={progress} max={100} />
      {steps[currentStep].content}
      <button onClick={prev}>Back</button>
      <button onClick={next} disabled={!canProceed}>
        {isLast ? "Finish" : "Next"}
      </button>
    </>
  );
}
```

## API

### `<Stepper />` props

| Prop           | Type                            | Default     | Description                                                            |
| -------------- | ------------------------------- | ----------- | --------------------------------------------------------------------- |
| `steps`        | `Step[]`                        | _required_  | Ordered list of steps to render.                                      |
| `initialStep`  | `number`                        | `0`         | Step to start on (clamped into range).                                |
| `onStepChange` | `(step: number) => void`        | —           | Fired when the active step index changes.                             |
| `onComplete`   | `() => void`                    | —           | Fired when Finish is clicked on the last (valid) step.                |
| `labels`       | `{ next?; prev?; finish? }`     | sensible    | Override the default control button labels.                           |
| `renderFooter` | `(api: StepperApi) => ReactNode`| —           | Replace the default Back/Next footer with custom controls.            |
| `className`    | `string`                        | —           | Class applied to the root element.                                    |

### `Step`

| Field      | Type               | Description                                                        |
| ---------- | ------------------ | ------------------------------------------------------------------ |
| `id`       | `string`           | Stable identifier (used as the React key).                        |
| `label`    | `string`           | Label shown in the progress header.                               |
| `content`  | `ReactNode`        | Content rendered when the step is active.                         |
| `validate` | `() => boolean`    | Optional. Return `true` to allow advancing past this step.        |

### `useStepper(steps, options?)` → `StepperApi`

Returns `{ currentStep, stepCount, isFirst, isLast, progress, canProceed, next, prev, goTo, reset }`. `next` and forward `goTo` are no-ops while `canProceed` is `false`.

> **Note:** validation gates only *forward* movement. Users can always step backward to revisit and fix earlier steps without re-passing validators.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). Run `npm install`, then `npm run typecheck` and `npm test` before opening a PR.

## Contact — Viprasol Tech Private Limited

- Website: [viprasol.com](https://viprasol.com)
- Email: [support@viprasol.com](mailto:support@viprasol.com)
- Telegram: [t.me/viprasol_help](https://t.me/viprasol_help) | WhatsApp: +91 96336 52112
- GitHub: [@Viprasol-Tech](https://github.com/Viprasol-Tech) | [LinkedIn](https://www.linkedin.com/in/viprasol/) | X [@viprasol](https://twitter.com/viprasol)

## License

[MIT](LICENSE) (c) 2025 Viprasol Tech Private Limited
