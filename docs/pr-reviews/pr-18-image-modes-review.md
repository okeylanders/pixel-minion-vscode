# PR #18 Image modes and earlier threads review

- PR: https://github.com/okeylanders/pixel-minion-vscode/pull/18
- Reviewed source: `6ba8d463b8555eaedca533249db492b08244021e`
- Reviewed base: `befd256731db9257ab50606d29d6a969d310ae11` (PR #17)
- Date: 2026-11-12
- Verdict: **changes requested: one medium finding.** No merge performed.
- **Status:** R18-1 fixed in `790f3c4` (classification by base model id; regression cases through the route helpers, the Settings field and the host). Validation rows R18-M1/M2 remain owner-run. 63 suites / 1,268 tests.

## Status ledger

| ID | Priority | Finding | Status |
| --- | --- | --- | --- |
| R18-1 | P2 / Medium | Known raster model variants bypass SVG preflight refusal | ✅ Fixed in `790f3c4` |
| R18-M1 | Validation | Installed-VSIX 360 px Dark/Light/High Contrast, keyboard and accessibility checks | ⏳ Open; not performed in this review |
| R18-M2 | Validation | Remaining paid provider checks inherited from #17 | ⏳ Open; no paid provider calls performed |
| R18-D1 | Baseline debt | Lint remains at 9 errors / 20 warnings | ↪ Deferred (existing configuration/debt, not introduced here) |

## R18-1: Classify the base model ID before rejecting raster models

Location: `src/shared/svg/svgRoutes.ts:51–56`.

The custom model field explicitly accepts `vendor/model[:variant]`. The new refusal guard tests the full string against `RASTER_IMAGE_IDS`, so adding a variant to a known raster model makes it pass as an unknown text-SVG model:

```ts
svgModelRefusal('black-forest-labs/flux.2-pro');       // refusal
svgModelRefusal('black-forest-labs/flux.2-pro:nitro'); // null
isNativeVectorSvgModel('black-forest-labs/flux.2-pro:nitro'); // false
```

The suffixed ID is accepted by `customModelIdFor` with the SVG catalog IDs, passes the Settings/UI/host guard, and reaches the text client rather than being refused locally. The same classification gap applies to `:floor` or another accepted variant. This violates the new contract that known raster models cannot be selected or dispatched for SVG generation. The provider may reject the request or produce unusable output; billing depends on provider acceptance. No paid call was made, and this report does not claim a specific provider charge or response.

Vector detection already strips the suffix at line 40. Normalize and classify the base ID for known catalog/raster membership and provider checks, while preserving the full selected ID for dispatch where it is eligible. Include canonical casing as appropriate, consistent with the custom field's catalog canonicalization. Add regression coverage for plain and suffixed raster IDs through the field and the host preflight, plus positive text/vector variants.

**Evidence:** a temporary focused Jest witness confirmed that the plain ID is refused, the supported-format suffixed ID is accepted by the custom field, and its refusal is null. The witness was removed after the probe; no production code was edited.

## Scope reviewed

Observed flow: mode buttons and image actions → image-generation hook state machine → correlation-owned request → shared #17 host orchestration. Archive/delete actions release host threads separately from the bounded display archive.

Reviewed the incremental delta for:
- Mode switches, explicit click/Enter/Space behavior, and draft-mode persistence.
- Provisional Generate archives, success/release and failure restoration, repeated actions and current/earlier thread ownership.
- Start-from-image capability gating, retained image context, deletion and focus management.
- Bounded earlier-thread persistence, validation of restored state, and warning lifetimes.
- Custom model IDs, Settings validation, SVG route/refinement selection and host refusal.
- Layout/CSS changes and supporting tests.

No additional concrete blocker was found in those paths. This is an incremental #18 review, not a substitute for #17's separate transport/recovery review.

## Independent verification

At the reviewed source:
- `npx jest --runInBand`: **63 suites / 1,266 tests passed**.
- All three TypeScript configs (`tsconfig.json`, `tsconfig.webview.json`, `tsconfig.test.json`): passed.
- Production webpack build: passed with three bundle-size warnings.
- `npm run lint`: **9 errors / 20 warnings**, not clean; matches the documented baseline. Changed files have no lint errors and two existing warnings.
- Focused variant-refusal witness: confirmed R18-1.
- GitHub commit-status and PR-triggered workflow queries returned no entries for the reviewed source; no remote-CI-green claim.

Native VS Code, fresh visual rendering/theme/keyboard/accessibility acceptance and live-provider checks were not performed. Existing PR screenshot/live-check claims are not represented as independently repeated.

## Resolution Status

- **R18-1 ✅ Fixed in `790f3c4`.** `src/shared/svg/svgRoutes.ts` classifies the model an id names, its base before any `:variant`, lower-cased:
  - `svgModelRefusal` and `isNativeVectorSvgModel` both use this key. Catalog kinds and the Image catalog's raster set are keyed the same way.
  - The full id is still what gets dispatched.
  - `customModelIdFor` (`CustomModelIdField.tsx`) now maps the model part of a curated id with a variant to the curated casing, keeping the variant (`Recraft/Recraft-V4.1-Vector:floor` → `recraft/recraft-v4.1-vector:floor`).
  - Regression cases:
    - `svgRoutes.test.ts`: every Image-catalog id with `:nitro` / `:floor` and upper-cased is refused; every SVG-catalog id with a variant or other casing keeps its route; vector and text variants pass.
    - `SettingsViewCustomModel.test.tsx`: the Settings SVG field refuses `black-forest-labs/flux.2-pro:nitro`, other casings and Recraft variants, and stores vector and text variants.
    - `SVGOrchestrator.test.ts`: the host refuses the same ids before either client is called and dispatches `recraft/recraft-v4.1-vector:floor` under its full id on the vector route.
  - Mutation check: restoring the whole-id comparison fails three of these tests.
  - No paid call made.
- **R18-M1 / R18-M2** ⏳ unchanged: owner-run.
- **R18-D1** ↪ unchanged: the lint baseline is still 9 errors / 20 warnings.
