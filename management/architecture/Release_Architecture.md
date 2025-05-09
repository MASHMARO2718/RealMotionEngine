# Release Architecture

## 1  Scope
Documents the **versioning, tagging, change-log, and artefact-publication workflow** for RealMotionEngine (RME).  
It clarifies how we cut releases, what qualifies as “breaking”, and how bundled outputs (Next.js + Unity WebGL) are packaged for end-users.

---

## 2  Goals & Non-Goals
| Goals | Non-Goals |
| ----- | --------- |
| • Provide a predictable, repeatable release cadence | • Marketing copy / blog-post process |
| • Ensure all artefacts are reproducible from CI | • Infrastructure rollback details (see Deployment doc) |
| • Maintain Semantic Versioning (SemVer) integrity | • Mobile store submission steps |

---

## 3  Versioning Scheme
| Segment | Meaning | Example |
| ------- | ------- | ------- |
| **MAJOR** | Breaking API change (filter API, state shape) | `2.0.0` |
| **MINOR** | Backwards-compatible feature | `1.4.0` |
| **PATCH** | Bug fix / perf tweak | `1.4.3` |

Breaking commits must be prefixed `feat!:` or `fix!:` and automatically trigger **MAJOR** bump via `changeset` action.

---

## 4  Release Pipeline
```mermaid
flowchart LR
    Developer -->|merge PR| main
    main -->|create changelog| Changeset
    Changeset --> Tag[vX.Y.Z]
    Tag --> GHAction[release.yml]
    GHAction --> Build[CI Build Jobs]
    Build --> Assets(Upload artefacts)
    Assets --> Draft[Draft GitHub Release]
    Draft --> Review[Manual title/notes]
    Review --> Publish[Click “Publish”]
    Publish --> VercelPromote[Promote tag to production]
Unity WebGL build only runs on tag push (build-unity).

5 Artefact Matrix
Artefact	Source Job	File	Where Published
Next.js bundle	build-web	web-build.zip	GitHub Release assets, Vercel
Unity WebGL	build-unity	UnityBuild.zip	GitHub Release assets, Vercel /public/UnityBuild/
Docs	build-web	docs-site.zip	GitHub Pages (optional)

6 Changelog Generation
Changesets in each feature PR (pnpm changeset wizard)

On merge to main, version.yml bumps versions + regenerates CHANGELOG.md

Sections: Added, Changed, Fixed, Security (OWASP style)

7 Rollback Strategy
Select previous Git tag in GitHub Releases

“Promote to Production” in Vercel (blue-green)

Re-tag as vX.Y.Z-hotfix if minor patch applied

8 Release Cadence
Type	Frequency	Driven by
Patch	as needed (bug / CVE)	Maintainer discretion
Minor	roughly bi-weekly	Backlog burn-down
Major	when breaking API	ADR + community vote

9 Open Issues / TODO
 Automate Slack/Discord webhook on publish

 Sign Unity bundle with SRI hash for extra integrity

 Investigate GitHub Release Notes AI generator

10 Revision History
Date	Version	Notes
2025-05-09	0.1	Initial release-process skeleton