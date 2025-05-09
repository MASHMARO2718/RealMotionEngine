 # Deployment Architecture

## 1  Scope
Outlines **how RealMotionEngine packages, delivers, and serves assets**—from static Next.js pages and Unity WebGL bundles to research notebooks.  
Covers hosting targets (CDN / edge), environment configuration, and rollout strategy.  
(For CI build generation see *CI_Architecture.md*.)

---

## 2  Goals & Non-Goals
| Goals | Non-Goals |
| ----- | --------- |
| • Provide low-latency global delivery of WebGL & JS assets | • In-depth Kubernetes cluster tuning |
| • Enable zero-downtime blue-green deploys | • ML-training GPU fleet management |
| • Keep infra cost ≤ \$30 /month on hobby tier | • Detailed IAM policies (see Security doc) |

---

## 3  Deployment Topology
```mermaid
flowchart LR
    subgraph Edge CDN (Vercel)
        N[Next.js static] --> U[Unity WebGL bundle]
        N --> A[API Functions]
    end
    A -->|HTTPS| WS[Worker Site / REST]:::server
    classDef server fill:#f8f8f8,stroke:#888;
→ All static assets cached on edge; Functions invoked region-nearest.*

4 Environments & URLs
Env	URL	Branch	Auto Deploy?
Preview	*.vercel.app	every PR	yes
Staging	staging.realmotion.engine	dev	yes
Production	realmotion.engine	main (tag)	manual promote

5 Artefact Packaging
Asset	Source	Build job	Output
Next.js SSR	src/	build-web	.next/
Unity WebGL	unity/	build-unity	UnityBuild/
Research docs	research/notebooks/	build-web	/public/notebooks/

6 Configuration Injection
Config	Technique	Notes
Runtime API URL	NEXT_PUBLIC_API_URL env var	Vercel Env Vars
Feature flags	Remote JSON fetched on boot	Cached 1 h
Unity data path	Build-time replacement in UnityLoader.js	handled in CI

7 Rollback & Blue-Green
Tag previous prod commit (vX.Y.Z-rollback)

Vercel’s “Promote from Deployment” → instant switch

Database schema versioning via migrations table (safe down)

8 Monitoring & SLOs
Metric	Target	Tool
P90 Time-to-First-Byte	≤ 200 ms (global)	Vercel analytics
Unity bundle download	≤ 3 MB	build budget
Error rate	< 1 % 5xx	Sentry

9 Open Issues / TODO
 Investigate Service Worker for offline pose demo

 Automate staging → prod promotion via GitHub Action

10 Revision History
Date	Ver	Notes
2025-05-09	0.1	Initial skeleton created