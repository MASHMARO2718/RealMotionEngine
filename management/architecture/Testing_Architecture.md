 # Testing Architecture

## 1  Scope
Defines **testing layers, tools, coverage targets, and review gates** for RealMotionEngine (RME).  
Encompasses unit, integration, E2E, and performance tests across front-end, Worker, WASM, and CI.

---

## 2  Goals & Non-Goals
| Goals | Non-Goals |
| ----- | --------- |
| • Fail fast on regressions (PR-level) | • Full Unity play-mode tests |
| • ≥ 70 % branch coverage on `src/` | • Load-testing Unity GPU path |
| • Deterministic, headless CI runs | • Manual exploratory QA scripts |

---

## 3  Test Pyramid
```text
         ┌──────────┐
         │  E2E     │  (~10)
         └────▲─────┘
              │
        ┌─────┴─────┐
        │Integration│ (~50)
        └────▲─────┘
              │
    ┌─────────┴──────────┐
    │   Unit / Static    │ (~400)
    └────────────────────┘
4 Toolchain
Layer	Tool	Runner
Unit	Vitest (jsdom)	npm run test:unit
Integration	Vitest + @testing-library/react	npm run test:int
E2E	Playwright (Chromium)	npm run test:e2e
Static	ESLint, TypeScript, eslint-plugin-boundaries	CI pre-step
Performance	custom bench via @vitest/bench	npm run test:perf

5 Coverage Targets
Path	Threshold
src/**/*.{ts,tsx}	70 % lines & branches
worker/**/*.ts	80 %
src/wasm/plugins/*.js	excluded (native)

CI fails if thresholds unmet (see vitest.config.ts).

6 CI Integration
lint → ESLint + type-check

test → vitest run --coverage

Coverage uploaded to Codecov with PR comment

E2E runs only on push to main or on tag (playwright install --with-deps)

7 Sample Test Skeletons
7.1 Unit (Kalman maths)
ts
Copy
Edit
import { updateKalman } from '@/wasm/mock';

test('kalman converges', () => {
  const x = simulateNoise();
  const y = x.map(updateKalman);
  expect(variance(y)).toBeLessThan(variance(x));
});
7.2 Integration (Camera + Store)
tsx
Copy
Edit
render(<CameraInput />);
await waitFor(() => expect(screen.getByTestId('fps')).toHaveTextContent('30'));
7.3 E2E (Recording flow)
ts
Copy
Edit
test('record and download', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Start Recording');
  await page.waitForTimeout(2000);
  await page.click('text=Stop');
  await expect(page).toHaveDownloaded('recording.webm');
});
8 Open Issues / TODO
 Automate Unity WebGL smoke test via Playwright (iframe)

 Bench regressions budget file (benchmarks/*.csv)

9 Revision History
Date	Version	Notes
2025-05-09	0.1	Initial testing skeleton