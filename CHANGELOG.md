# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/); versioning
follows [SemVer](https://semver.org/).

## [0.2.0] - 2025

### Added
- **Async per-step validation.** `Step.validate` may now return a `Promise` and
  may resolve to either a `boolean` or `{ valid, message }`. The component
  surfaces the message inline (`role="alert"`) and the hook exposes it via
  `errors`. While a validator is in flight `isValidating` is `true`.
- **Optional / skippable steps** via `Step.optional`. The component renders a
  Skip button and `api.skip()` advances past the step, recording it in
  `skippedSteps`.
- **Disabled steps** via `Step.disabled`. Disabled steps are removed from the
  flow: not rendered, not counted in progress, and navigation steps over them.
- **Non-linear navigation.** New `linear` option (default `true`). When
  disabled, users may freely jump to any visited step or one step ahead.
  Backward jumps are always allowed.
- **Four progress variants** via the `variant` prop: `numbered` (default),
  `bar`, `dots`, and `ratio`.
- **Clickable step headers** (`clickableSteps`, default `true`) with correct
  enabled/disabled state per linear rules.
- **Form-state collection.** `initialData`, `setStepData` (deep-merges object
  slices), `setFormData`, `getStepData`, and a `formData` record keyed by step
  id. Validators receive their step's data slice.
- **Enriched `useStepper` return**: `activeStepCount`, `isValidating`,
  `isComplete`, `visitedSteps`, `completedSteps`, `skippedSteps`, `errors`,
  `steps` (per-step metadata), `formData`, `skip`, `setStepData`, `setFormData`,
  `getStepData`, and `setError`. `next`/`goTo` now return `Promise<boolean>`.
- **Accessibility**: `aria-busy` on content/controls during async validation,
  `aria-current="step"`, `role="alert"` errors, and per-step `aria-label`s.
- New reducer actions and helpers (`SKIP`, `COMPLETE`, `SET_ERROR`,
  `SET_ACTIVE_INDICES`, `snapToActive`, `nextActive`, `prevActive`).
- Roughly tripled the test suite (74 tests across reducer, hook, and component).

### Changed
- The Next button is no longer pre-disabled on invalid steps; clicking it runs
  validation and shows an error when the step is incomplete. It is disabled only
  while an async validator is running.
- Progress is now computed over the active (non-disabled) steps only.
- `onStepChange` now receives `(nextIndex, prevIndex)`.

## [0.1.0] - 2025

### Added
- Initial release of react-form-stepper: Multi-step form wizard component for React with validation per step.
