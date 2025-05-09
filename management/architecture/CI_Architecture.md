# CI / Build Architecture

## 1  Scope
Defines **Continuous Integration and build pipelines** for RealMotionEngine (RME).  
Covers linting, tests, Unity WebGL build, artefact upload, release tagging, and branch protection.  
(Does **not** cover runtime deployment infra — see *Deployment_Architecture.md*.)

---

## 2  Goals & Non-Goals
| Goals | Non-Goals |
| ----- | --------- |
| • Catch lint / type / test failures before merge | • Full Unity Cloud-Build docs |
| • Produce reproducible WebGL bundles on version tags | • CDN delivery details |
| • Provide fast feedback (< 5 min) on PRs | • Heavy load-test orchestration |

---

## 3  High-Level Pipeline Diagram
```mermaid
flowchart TB
    subgraph GitHub
        P(Push / PR) --> A[CI Action: Lint & Type-check]
        A --> B[Test (Vitest)]
        B -->|coverage ≥ 70 %| C[Build Next.js]
        C --> D[Unity WebGL Build (if tag)]
        D --> E[Upload artefacts]
        C --> E
        E --> Status[Checks ✓]
    end
4 Job Matrix & Triggers
Job ID	Trigger	Runs-on	Key Steps	Artefacts
lint	push, pull_request	ubuntu-latest	pnpm install, pnpm lint	–
test	push, pull_request	ubuntu-latest	pnpm test:ci	coverage XML
build-web	same	ubuntu-latest	pnpm build	.next/ bundle
build-unity	push tags/**	ubuntu-latest + Unity CLI	unity -batchmode -executeMethod BuildWebGL	UnityBuild/
release	push tags/v*	ubuntu-latest	Draft GitHub Release, upload assets	release zip

5 Branch & Tag Strategy
Branch	Purpose	Protection Rules
main	deployable latest	require all CI ✓, linear history
dev	integration line	optional CI, squash-merge
feature/*	short-lived work	–
Tags vMAJOR.MINOR.PATCH	releases	trigger Unity build + release job

6 Performance Targets
Metric	Budget
Lint + Type	≤ 60 s
Unit Tests	≤ 120 s
Next.js build	≤ 180 s
Unity WebGL build	≤ 10 min (cache gradle)

7 Secrets & Permissions
UNITY_LICENSE (base64) — GitHub Secrets

NODE_AUTH_TOKEN for private registry

CI token has read-packages only; release job uses PAT with write:packages

8 Open Issues / TODO
 Cache ~/.cache/unity to cut WebGL build time

 Split test matrix for Node 18 / 20

9 Revision History
Date	Ver	Notes
2025-05-09	0.1	Initial skeleton