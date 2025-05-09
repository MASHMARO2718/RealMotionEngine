 # Security Architecture

## 1  Scope
Defines RealMotionEngine’s **threat model, security objectives, and concrete controls** applied across front-end, Worker, back-end APIs, and CI/CD.  
Cryptography details, credentials rotation, and legal compliance (GDPR / COPPA) are *referenced* but handled in separate policies.

---

## 2  Threat Model
| ID | Threat                             | Vector / Asset           | Impact        |
|----|------------------------------------|--------------------------|---------------|
| T-1| XSS via untrusted user input       | React props / query-str  | Credential theft, session hijack |
| T-2| WASM memory corruption             | Malicious plugin wasm    | Arbitrary code exec in browser context |
| T-3| CSRF on API endpoints              | `/api/upload`, `/api/train` | Data poisoning |
| T-4| Supply-chain dependency attack     | npm package compromise   | CI malware, data exfil |
| T-5| UnityLoader remote code injection  | Modified WebGL .js file  | XSS / session hijack |

---

## 3  Security Goals & Non-Goals
| Goals | Non-Goals |
| ----- | --------- |
| • Content Security Policy locks JS origins | • DRM / copy-protection of Unity assets |
| • All external input schema-validated (Zod) | • Perfect forward secrecy past 90 days |
| • Automatic SCA (Snyk / Dependabot) on CI  | • Pen-testing playbooks |

---

## 4  High-Level Security Diagram
```mermaid
flowchart LR
    Browser -->|HTTPS + CSP| EdgeCDN
    EdgeCDN -->|signed cookies| API[Vercel Functions]
    API --> DB[(Serverless KV)]
    Browser -->|POST log (signed)| API
5 Attack Surface & Controls
Surface	Control	Tool / Setting
DOM XSS	React auto-esc + helmet CSP default-src 'self'	next-secure-headers
WASM	crossOriginIsolation headers + COOP/COEP	Next.js middleware
CSRF	Same-site cookies Lax + CSRF token header	next-csrf
Dependencies	Automated PR scan	Dependabot ± Snyk
Secrets	GitHub Secrets (CI); .env in Vercel	512-bit encrypted at rest

6 Secure Coding Practices
Zod schema for every external API payload

Strict TypeScript (noUncheckedIndexedAccess, exactOptionalPropertyTypes)

fetch() wrapper adds Integrity header + timeout

Unity WebGL build hashed filenames + Subresource Integrity meta

7 Dependency Management
Renovate checks weekly → opens PRs → CI runs SCA

Major upgrades require manual review & feat! label

npm audit --production gate in CI (fail on high severity)

8 Open Issues / TODO
 Evaluate WebAuthn for admin login

 Add CSP script-src SHA pre-generation for Next.js chunks

 Pen-test schedule (quarterly)

9 Revision History
Date	Version	Notes
2025-05-09	0.1	Initial skeleton