# Best Practices Architecture

## 1  Scope
Consolidates **cross-cutting development guidelines** for RealMotionEngine (RME) that fall outside specific layers—covering code style, accessibility, performance budgets, documentation, and team workflow norms.

---

## 2  Guiding Principles
1. **Clarity over cleverness** — optimise for readability and maintainability.  
2. **Performance-conscious by default** — measure before you micro-optimise.  
3. **Accessibility is a feature** — WCAG-AA is the baseline, not an after-thought.  
4. **Document the *why*** — every major decision gets a short rationale in its PR.

---

## 3  Code Style & Lint
| Topic | Rule |
| ----- | ---- |
| ESLint | `@typescript-eslint/recommended` + `plugin:react-hooks/recommended` |
| Formatting | Prettier (120 columns, single-quote, trailing-comma-all) |
| File headers | SPDX licence identifier + concise module summary |
| Import order | `eslint-plugin-simple-import-sort` (groups: react, third-party, alias, relative) |
| Naming | `PascalCase` for components, `camelCase` for utils, `SCREAMING_SNAKE` for env vars |

*Fail CI if `npm run lint` errors.*

---

## 4  Accessibility (A11y)
| Guideline | Target |
| ----------| ------ |
| Lighthouse score | **≥ 90** in A11y category on `/` page |
| ARIA | All interactive elements have `aria-label` / `aria-labelledby` |
| Colour contrast | ≥ 4.5:1 (WCAG-AA) |
| Keyboard nav | Tabbing order logical; focus ring visible |

---

## 5  Performance Budgets
| Area | Budget | Tool |
| ---- | ------ | ---- |
| WebGL FPS | ≥ 60 fps (desktop) | Unity profiler overlay |
| WASM call | ≤ 1 ms per filter update | Vitest bench |
| First Gen TTFB | ≤ 200 ms global (P90) | Vercel analytics |
| JS bundle | ≤ 300 KB (gz) main chunk | `next build` output |

CI fails if **bundle size** regresses >10 %.

---

## 6  Documentation & Commit Hygiene
| Practice | Detail |
| -------- | ------ |
| ADRs | Big design shifts → `management/adr/YYYY-MM-DD-title.md` |
| PR template | Fill **Context / Changes / Checklist / Related Docs** |
| Commit style | Conventional Commits; breaking change → `feat!:` |
| Storybook | New visual component requires a `.stories.tsx` file |

---

## 7  Review Checklist (Human)
- [ ] Does code reuse existing utils/hooks?  
- [ ] Are props and return types strictly typed?  
- [ ] Any unhandled promise rejections?  
- [ ] Tests added or updated?  
- [ ] Docs/Architecture MD linked in PR?

---

## 8  Open Issues / Improvements
- [ ] Automate A11y audit in CI via `pa11y-ci`  
- [ ] Add bundle-stat bot comment on PRs  
- [ ] Draft CSS naming convention (BEM vs CEM)

---

## 9  Revision History
| Date       | Version | Notes |
| ---------- | ------- | ----- |
| 2025-05-09 | 0.1     | Initial best-practices skeleton |
