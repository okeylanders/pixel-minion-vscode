# Pixel Minion ← Frame Minion: image-generator parity and port plan

**Status:** Investigation complete, 2026-11-07 (no code changed, no paid generations). P3 implemented 2026-11-12: see [§8](#8-p3-as-built-2026-11-12).
**Decision:** [Declared] Pixel's image generator should do what Frame's now does, with nothing that uses fal.ai, and Pixel's model picker should look and behave the same as Frame's.
**Inspected:**
- Frame `40e7949` (detached worktree of `feat/video-models-sprint-06`), which contains `aa1bab1 23be8e8 eea465c 51ef963 5492f94 a61d131 658396d b138cb7 ce4ae49`.
- Pixel `57bab83` (`claude/pixel-minion-design-review-dhbqpd`, the head of draft PR #12).

Both trees were read-only and clean.

**Path shorthand:**
- `F:core/…` = `packages/core/src/…` in the Frame worktree.
- `F:app/…` = `apps/vscode-extension/src/…`.
- `F:docs/…` = Frame `docs/…`.
- `P:…` = `src/…` in this repository.

**Evidence tags:** [Observed] means I read the code or doc at the cited line. [Inferred] means a judgement, estimate, or browser/provider behaviour I did not run.

---

## 0. Headline

1. **[Observed] The two codebases are still siblings. Most of Frame's image engine can be copied almost unchanged.**
   - Pixel's `ImageConversationManager` differs from Frame's only by mode/resolution/`restore()` and a shallow clone. Compare `P:infrastructure/ai/orchestration/ImageConversationManager.ts:49,135` with `F:core/infrastructure/ai/orchestration/ImageConversationManager.ts:52,142,238`.
   - The handler, orchestrator, client interface and hook have the same shape, but none of Frame's later work.
   - Pixel's 34 image ids are a strict subset of Frame's 54 rows. Frame has 20 rows Pixel lacks.
2. **[Observed] The picker at PR #12 is a partial port that still prices models by vendor prefix.** `P:presentation/webview/components/shared/modelBrowserOptions.ts:88-122` infers units from `id.startsWith(...)` and applies a blanket 1,290-token estimate. Frame's research corrected this assumption (`F:docs/research/image-price-estimates.md:77-79`).
   - Result [Observed + calculated]: Pixel shows GPT Image 2 / GPT-5.4 Image 2 at ≈ $0.039 per image. Frame's documented reference is ≈ $0.211 @ 1K high. That is about 5× too low.
   - Gemini 3.1 Flash: Pixel ≈ $0.077, Frame $0.0672.
   - MAI 2.5: Pixel's input rate is $5, Frame's is $8.
3. **[Observed] Pixel has several live request-ownership bugs that Frame already fixed.**
   - No correlation IDs.
   - A stale closure on `referenceSvgText`.
   - SVG reference text is appended twice.
   - No rollback of a failed turn.
   - Enhance errors are broadcast to both tabs.
   - `persistedState` is rebuilt on every render.

   These are cheap to fix and should go first (PR P2).
4. **[Observed] Frame's assessment of Pixel's SVG feature is confirmed at the PR #12 head.**
   - Generated SVG is inserted into the app's DOM five times per result.
   - The webview CSP stops scripts but not injected `<style>`.
   - Async ownership and replay are incomplete.
   - Routing is decided by vendor prefix.
   - The "Saved" state is set by a one-second timer, not the save result.

   F5 and F6 do not apply to Pixel (§4).

---

## 1. Parity matrix

Effort is [Inferred]: **S** ≤ 1 day, **M** 2–4 days, **L** 5+ days, each including tests. "Verbatim" means copy the file and change only imports, brand strings and token names.

| # | Capability | Frame implementation | Pixel today | Gap | Port approach for Pixel | Effort | Risk |
|---|---|---|---|---|---|---|---|
| 1 | **Conversation vs Single Shot modes** (the internal value `edit` is the UI's Single Shot) | Mode type `F:core/shared/types/messages/imageGeneration.ts:15`; labels `F:core/shared/models/ImageGenerationModes.ts:57-76`; radio `F:core/presentation/webview/components/views/ImageGenerationView.tsx:108-115`; `setMode` archives the current thread `F:…/hooks/domain/useImageGeneration.ts:326-333` | No mode. Every request replays the whole chat history (`P:infrastructure/ai/clients/OpenRouterImageClient.ts:50-65`) | Whole feature missing | **Verbatim:** `ImageGenerationModes.ts` without `imageFrameModelUnavailableReason` / `imageFrameAspectRatioPolicy` (`:78-108`, MVO only). The radio, labels and descriptions are also verbatim. **Adapt:** the migration rationale (row 9) | M | Medium: behaviour change for non-chat models |
| 2 | **Two transports (`/images` vs `/chat/completions`), with Muse on chat for both modes** | `F:core/infrastructure/ai/clients/OpenRouterImageTransport.ts:23-119`; transport choice and validation `OpenRouterImageClient.ts:37-100`; Muse row `F:core/shared/models/ImageModels.ts` (`transport: 'chat-completions'`); Muse capabilities `ImageGenerationModes.ts:42-44` | Chat only. Modalities guessed from the vendor prefix (`P:…/OpenRouterImageClient.ts:217-237`). Sends the deprecated `usage: { include: true }` (`:64`) | `/images` path missing, so the 20 newer models (several `/images`-only) cannot be offered | **Verbatim:** `OpenRouterImageTransport.ts` and the client (keep Pixel's `HTTP-Referer` / `X-Title`). Remove `usage.include` on purpose and pin its absence with a test (lesson F-3, `F:docs/pr-reviews/pr-54-…:234`) | M | Medium: provider fidelity needs paid checks |
| 3 | **Capability resolution** | `imageRouteCapabilities()` `ImageGenerationModes.ts:25-55`; per-row fields in `ImageModelDefinition` `F:core/shared/types/providers.ts:96-118`; chat allow-lists `ImageGenerationModes.ts:16-23` | `ModelDefinition` holds only id, name, description and per-1M costs (`P:shared/types/providers.ts:12-18`) | No capability data at all | **Verbatim:** interface, `ASPECT_RATIOS` table and rows (`F:core/shared/models/ImageModels.ts:33-147`). Move the catalog to `P:shared/models/` as Frame did (Pixel's presentation layer currently imports infrastructure, e.g. `P:…/views/ImageGenerationView.tsx:18`) | M | Low |
| 4 | **Aspect ratios, including `auto`** | 26-value `AspectRatio` `F:…/messages/imageGeneration.ts:7-12`; Auto is omitted when unverified: `/images` `OpenRouterImageTransport.ts:37-38`, chat `:69-71` | Seven fixed values with pixel sizes (`P:shared/types/messages/imageGeneration.ts:6-16`); always sends `image_config.aspect_ratio` | No `auto`, no per-model lists | **Adapt:** keep Frame's name `AspectRatio` for images and rename Pixel's 7-value type to `SVGAspectRatio`, keeping `ASPECT_RATIO_DIMENSIONS`, because SVG builds its viewBox from it (`P:infrastructure/ai/orchestration/SVGConversationManager.ts:59,200`). `AspectRatioSelector` is shared with SVG today (`P:…/views/SVGGenerationView.tsx:101`), so give SVG its own ratio list | S | Medium: touches the shared SVG type |
| 5 | **Resolution tiers** | `ImageResolution` `F:…/imageGeneration.ts:13`; `ResolutionSelector.tsx`; chat uses Gemini K tiers only and drops `512` (`ImageGenerationModes.ts:49-52`); `/images` `resolution` (`OpenRouterImageTransport.ts:39`) | None | Missing | **Verbatim** | S | Low (returned dimensions are not certified, `F:docs/plans/image-conversation-edit-modes.md:82`) |
| 6 | **Seed support** | `supportsSeed`; `seedSupported` on results (`OpenRouterImageClient.ts:65,98`); the seed input is hidden (`ImageGenerationView.tsx:141`); `ImageCard` hides the seed chip (`F:…/components/image/ImageCard.tsx:111`) | Seed input and chip always shown (`P:…/views/ImageGenerationView.tsx:114-122`, `P:…/image/ImageCard.tsx:55-62`) | Missing | **Verbatim** | S | Low |
| 7 | **Reference image min/max and MIME allowlist** | Host checks `OpenRouterImageClient.ts:44-57`; webview checks `useImageGeneration.ts:357-362`; uploader `maxImages`/`accept` (`ImageGenerationView.tsx:174-175`); Recraft Styles copy (`:196-198`) | Uploader fixed at 4 images with a fixed `accept` (`P:…/image/ImageUploader.tsx:24,90`); no host check | Missing; text-only models (max 0) not handled | **Verbatim** (`ImageUploader` diff is about 6 lines) | S | Low |
| 8 | **Controls driven by capabilities, normalized when an option disappears** | `normalizeAspectRatioForModel` / `normalizeResolutionForModel` `useImageGeneration.ts:40-49`, applied in `setModel` / `setMode` / settings sync (`:189-203,326-333`) | Static controls | Missing | **Verbatim** | S | Low |
| 9 | **Settings owned by the thread, plus migration** | `ImageThreadSettings` `F:…/imageGeneration.ts:18-23`; host enforcement `ImageOrchestrator.ts:83-101,204-209`; webview `continueChat` sends `threadSettings` (`useImageGeneration.ts:376-395`); "Controls above apply to a new thread" (`ImageGenerationView.tsx:225`); untagged history opens as Single Shot (`useImageGeneration.ts:158`) | `continueChat` sends the **draft** `model`/`aspectRatio` (`P:presentation/webview/hooks/domain/useImageGeneration.ts:331-332`). In memory the host ignores them (`P:…/ImageOrchestrator.ts:148-151`), but rehydration after a restart uses them (`:138-140`), so the effective model depends on whether the host restarted | Inconsistent semantics today | **Verbatim.** The migration rule is the same, for a different reason: Pixel's untagged threads were conversational in spirit, but there is no host transcript for them, so they can only continue as Single Shot. State this in the changelog | M | Medium: users see changed continuation semantics |
| 10 | **"Earlier threads" archives** | `archiveCurrentThread`, `removeArchivedThread` `useImageGeneration.ts:313-347`; UI `ImageGenerationView.tsx:263-273` | `generate()` throws away the previous thread (`P:…/useImageGeneration.ts:264-266`) | Missing | **Verbatim.** Must ship together with bounded persistence (row 13); unbounded archives were Frame's F-6 | M | Medium |
| 11 | **Start a new thread from an image** | `startFromImage` `useImageGeneration.ts:335-342`; card button `ImageCard.tsx:122`; disabled for text-only models (`ImageGenerationView.tsx:256`) | None | Missing | **Verbatim** (drop the card's video/MVO action groups) | S | Low |
| 12 | **Host-owned transcript store, restart recovery, 64 MiB cap, tombstones** | `FileImageConversationStore` `F:core/infrastructure/ai/orchestration/ImageConversationStore.ts:1-70` (id regex `:14`, size limit `:21`, workspace-hash scope `:24-25`, tombstone `:68`); restore `ImageOrchestrator.ts:182-193`; turn-count check `:204`; `recoveryWarning` `:132-139` | Lossy rehydration from display history only (`P:…/ImageOrchestrator.ts:137-141`); signatures are lost | Missing | **Verbatim store.** **Adapt the ports:** copy Frame's vscode-free `FileSystem` and `Workspace` interfaces (`F:core/platform/FileSystem.ts:45-57`, `Workspace.ts:25-37`) into `P:platform/`, and add thin VS Code adapters modelled on `F:app/platform/vscode/VsCodeFileSystem.ts` (keep the mkdir-p-before-write rule) and `VsCodeWorkspace.ts`. Pass `context.globalStorageUri` into `MessageHandler` via `extension.ts` and `WebviewViewProvider` (`P:extension.ts:43`, `P:application/providers/WebviewViewProvider.ts:48-52`). Keep Pixel's Uri-based **save** path (row 16) rather than Frame's port-based `saveImage`, which uses `firstFileWorkspaceFolder()` and would change behaviour in virtual workspaces | M | Medium: inherits F-7 retention, F-10 mid-generation reload, R-4 |
| 13 | **Bounded webview persistence** (5 archives, 48 MiB, 64 KiB draft reserve, memoized) | `F:core/presentation/webview/hooks/domain/imageHistoryPersistence.ts:1-64`; memoization `useImageGeneration.ts:446-456`; "images omitted" note `ConversationThread.tsx:60` | Unbounded `vscode.setState` of base64 images (`P:…/useImageGeneration.ts:395-402`). The object is **new on every render**, so `saveState` runs on every render or keystroke (`P:presentation/webview/App.tsx:164-179`) | Missing; worse than Frame's R-3 | **Verbatim.** Drop the desktop budget override (`window.__FRAME_MINION__.imageHistoryBudgetBytes`) and use the 48 MiB default (R-1) | S | Low |
| 14 | **Per-thread in-flight guard and rollback of failed turns** | `inFlight` `ImageOrchestrator.ts:43,102-103,166,227`; rollback and first-turn release `:160-165` | No guard. A failed turn leaves its user message in `conversation.messages` (`P:…/ImageOrchestrator.ts:92-104`, no try/catch), so the next request repeats the failed prompt | Bug | **Verbatim fragment** (can ship before modes; P2) | S | Low |
| 15 | **Distinct correlation IDs** | `newRequestId` `useImageGeneration.ts:30-33`; `pending` ref `:184`; stale responses dropped `:225-226`; enhance `:249-255,441-443`; `image-clear-` prefix `:265,346,399` | No ids are sent (`P:…/useImageGeneration.ts:277-290,382-391`); the response is applied unconditionally (`:167-191`); `referenceSvgText` is read inside a `useCallback(..., [])` and is therefore always null (`:182,191`). The host already echoes `correlationId` (`P:application/handlers/domain/EnhanceHandler.ts:97,112`; `ImageGenerationHandler.ts:79`) | Bug | **Verbatim fragment.** Webview only; no host change (P2) | S | Low |
| 16 | **Output MIME detection, WebP/GIF saving, natural dimensions** | Byte sniffing and rejection `OpenRouterImageTransport.ts:14-21,53-61`; `image/jpg` normalized `:94-101`; `imageFileExtension` `ImageGenerationHandler.ts:315-319`; hook extension `useImageGeneration.ts:412`; `ImageCard` aspect from request or natural size `ImageCard.tsx:89-104` | Any `image/[\w.+-]+` accepted (`P:…/OpenRouterImageClient.ts:184`); WebP/GIF saved as `.jpg` (hook `P:…/useImageGeneration.ts:354`, handler `ImageGenerationHandler.ts:235,244`); card is always square (`P:…/styles/components/image-card.css:11`) | Bug and missing feature | **Verbatim** transport and extension mapping (mapping in P2); natural-dimension card in P3 | S | Low |
| 17 | **Unit-aware price labels and per-image estimates** | `ImagePricing` `F:core/shared/types/providers.ts:62-87`; labels `F:…/components/shared/modelBrowserOptions.ts:360-418`; estimates are stored per row with `approxBasis`; evidence `F:docs/research/image-price-estimates.md` | Prefix heuristics (`P:…/modelBrowserOptions.ts:88-122`); only Krea, MAI, Grok and Gemini rates are close to Frame's (§0 #2) | Wrong numbers | **Verbatim** catalog pricing and label functions. Re-check rates against the live `GET /api/v1/images/models/*/endpoints` before merging; Frame's audit is about 5 weeks old | S | Low (data) / user-visible |
| 18 | **Model browser modal** | `F:…/components/shared/ModelBrowserModal.tsx:1-337`: search over 11 fields `:56-73`; **three** pivots including release date `:215-243`; month grouping `:75-82`; strict date check `:40-46`; chips with counts; card shows `costDescription` plus narrative plus supporting description `:97-104,311-319`; `metaLabel`; `warn` badge; OpenRouter provider highlight `:271-274`; Escape and backdrop close | Two pivots only (`P:…/ModelBrowserModal.tsx:17,156-175`); no `costDescription`, `metaLabel` or `warn`; description shown only when there is no narrative (`:241-246`). Pixel is better on: `autoFocus` search (`:147`), clearing the query on close (`:105-107`), `role=dialog` on the panel rather than the backdrop (`:125-131`) | Look and behaviour differ | **Verbatim Frame modal**, re-applying Pixel's three a11y improvements and a `footerLabel` prop instead of the hard-coded "Curated by Frame Minion". Upstream the same small changes to Frame so the file becomes identical except for CSS tokens. Neither app has a focus trap or restores focus on close; treat that as a shared follow-up | S | Low |
| 19 | **Model browser select (trigger)** | `F:…/components/shared/ModelBrowserSelect.tsx:23-65`: single-line label plus chevron SVG, `helperText`, `loadingLabel`, `Custom: <id>` fallback; image `ModelSelector` adds a custom row and the unavailable helper (`F:…/image/ModelSelector.tsx:26-41`) | 44 px two-line trigger with an estimate sub-line and `⌄` glyph (`P:…/ModelBrowserSelect.tsx:28-41`, CSS `model-browser.css:399-436`); no helper text | Looks different | **Verbatim** plus `aria-haspopup` from Pixel. The design-fixup PR must not restyle the trigger back | S | Low: design call |
| 20 | **Custom model ids** | Unknown id gets permissive Single Shot (`ImageGenerationModes.ts:27-29`); Conversation stays strict; the id stays visible (`ModelSelector.tsx:26-29`, `ImageGenerationView.tsx:122`) | `Custom: <id>` label only; still sent over chat | Policy missing | **Verbatim** (P4) | S | Low |
| 21 | **Text-only models (max 0 references)** | Uploader note (`ImageUploader.tsx:76`); continue box and start-from-image hidden (`ImageGenerationView.tsx:221-223,283`) | n/a | Missing (arrives with the new rows) | **Verbatim** | S | Low |
| 22 | **Mode and endpoint copy** | `imageModeEndpointDescription` `ImageGenerationModes.ts:68-76`; "⚡ Start Conversation" `ImageGenerationView.tsx:205`; `ContinueChatInput` `submitLabel` (`F:…/shared/ContinueChatInput.tsx:20-25,65`) | n/a | Missing | **Verbatim** | S | Low |
| 23 | **Gemini thought-signature preservation and unsigned fallback** | Deep clone `ImageConversationManager.ts:141-147`; unsigned image parts stripped `:157-166`; latest images always re-attached as references (F-11) | Present; shallow clone `{...}` (`P:…/ImageConversationManager.ts:135`) | Minor | **Verbatim** manager | S | Low |
| 24 | **Native token accounting and spend refresh** | `parseResponse` `OpenRouterImageClient.ts:103-121` | Same calculation (`P:…/OpenRouterImageClient.ts:138-146`); balance refresh is triggered from `applyTokenUsage` (`P:application/handlers/MessageHandler.ts:151`) | None for accounting | Keep Pixel's refresh trigger; do **not** port Frame's `TERMINAL_AI_RESPONSE_TYPES` chokepoint | — | Low |
| 25 | **Catalog breadth** | 54 rows | 34 rows (strict subset; set difference checked [Observed]) | 20 rows missing: FLUX.3, Seedream 5 ×3, Qwen ×2, MAI 2.6 ×2, GPT Image 2.5 ×2, Muse, Ming, Recraft V4 Styles ×2, Recraft V4.1 Flash, Grok 2.0, three Riverflow previews, Gemini 2.5 preview | Add with P3, not P1: several are `/images`-only or need capability gating. Frame has no release-date metadata for 5 of them (`seedream-5-0-lite/-pro`, `qwen-image-3[-pro]`, `grok-imagine-image-2.0`); Pixel's "every curated model has a release date" test (`P:__tests__/presentation/webview/modelBrowserOptions.test.ts:49-56`) will fail, so add the dates and upstream them | S | Low |
| 26 | **Tests for `.tsx` components** | `jest.config.js` `testMatch` includes `.tsx`, CSS stub, `tsconfig.test.json` with `jsx` and DOM | `testMatch` is `*.test.ts` only, node environment, no JSX config (`P:../jest.config.js:4-6`); `@testing-library/react` 14 and `jest-environment-jsdom` are already dev dependencies | Blocks porting Frame's component/hook tests | **Adapt** Frame's config: `tsconfig.test.json`, `styleMock.js`, `testMatch`; tests use a per-file `@jest-environment jsdom` docblock as Frame's do | S | Low |
| 27 | **Honest "Saved" state** (not a Frame feature: a defect in both) | Frame still uses a one-second timer (`F:…/views/ImageGenerationView.tsx:92-104`) | Same (`P:…/views/ImageGenerationView.tsx:82-94`; SVG `SVGGenerationView.tsx:67-74`); `handleSaveResult` only records errors | Shared defect | Fix in Pixel (P2, keyed on `IMAGE_SAVE_RESULT.imageId`) and upstream to Frame | S | Low |
| 28 | **SVG reference text sent once** | Hook sends the raw prompt plus `referenceSvgText`; the manager appends it once (`useImageGeneration.ts:363-365`; manager `:110`; test "SVG exactly once" `ImageConversationModes.test.ts:50`) | The hook appends `Reference SVG:` to the prompt **and** sends `referenceSvgText`, and the manager appends it again (`P:…/useImageGeneration.ts:272-274,286` + `P:…/ImageConversationManager.ts:103`). Continuation also re-sends the **draft** attachment (`:319-321,334-335`), while the host silently drops draft raster references (`ImageGenerationContinuePayload` has no `referenceImages`; `P:shared/types/messages/imageGeneration.ts:40-54`) | Bug | **Verbatim** hook behaviour (P2) | S | Low |
| 29 | **Error routing** | Generation and enhance errors matched by correlation inside the hook (`useImageGeneration.ts:257-267`) | Routing by `source` substring; **enhance errors go to both hooks** (`P:presentation/webview/App.tsx:145-160`), so an Image-tab enhance failure stops the SVG spinner and shows the error in both tabs | Bug | Correlate in both hooks; App may then broadcast safely (P2) | S | Low |

### Bugs Frame found while building this (PR #54) that Pixel must not reintroduce

[Observed] in `F:docs/pr-reviews/pr-54-image-models-conversation-single-shot-review.md`:
- **F-1/F-2:** keep the unknown-id guard scoped to `options.mode !== undefined` (`ImageOrchestrator.ts:84`), and keep `clearConversation` skipping non-`img-` and Single Shot ids (`:233`). Pixel has no MVO caller, but copy both verbatim so the code stays identical.
- **F-3 lesson:** compare every rewritten request body field by field against the old one, and test the removal of `usage.include`.
- **F-4:** custom ids stay visible.
- **F-6/R-1:** bound archives, and use the 48 MiB extension budget, not 2 MiB.
- **R-3:** memoize the bounded history separately from the draft.
- **F-8:** a failed *new* thread clears its optimistic settings (`useImageGeneration.ts:259`).
- **F-9:** a corrupt transcript gives an actionable message (`ImageConversationStore.ts:17,47`).
- **F-12:** omit unverified `auto`, and reject unidentified bytes.
- **Inherited limitations to copy into Pixel's docs:**
  - F-7: whole-transcript rewrites, orphaned records, tombstones never expire.
  - F-10: reloading during generation strands the thread.
  - F-11: the latest image is billed twice.
  - R-4.

---

## 2. Scope boundaries

### Frame concepts to leave out

| Frame concept | Where | Why |
|---|---|---|
| MVO/TAVO frames: `imageFrameModelUnavailableReason`, `imageFrameAspectRatioPolicy`, `MusicVideoFramesOrchestrator` seam tests, `ImageModelSection` | `ImageGenerationModes.ts:78-108`; `ImageConversationModes.test.ts:180-202` | Pixel has no orchestrator |
| Desktop image-history budget and Electron composition fixtures | `useImageGeneration.ts:447`; `F:../apps/desktop/src/renderer/bootstrap.ts:51` | VS Code only |
| Everything fal: fal storage provider, fal balance, `falApiKey` | Frame CLAUDE.md, storage section | Owner decision. Note: the GPT Image 2.5 estimate in `image-price-estimates.md:28` *cites* fal's published price as evidence; the billed rate is OpenRouter's. Keeping the number is evidence, not integration |
| `ImageCard` "Send to video generator", "Send to project segment" and "Send to project" groups | `ImageCard.tsx:123-197`, `FrameTransferContext`, `OrchestratorBridgeContext` | No Video tab or MVO |
| Frame platform ports other than `FileSystem` and `Workspace` | `F:core/platform/*` | Not needed; Pixel's save stays on `vscode.Uri` (row 12) |
| `TERMINAL_AI_RESPONSE_TYPES` balance chokepoint | Frame `MessageHandler` | Pixel triggers the refresh from `applyTokenUsage` |
| Video, planner, enhancer and MVO option mappers in `modelBrowserOptions.ts` | `:450-626` | No consumers |
| The "Recraft vector excluded because of the raster pipeline" comment | `ImageModels.ts` Recraft block | Pixel excludes vector rows from the Image tab for a different reason (they belong to the SVG tab); reword the comment |

### Pixel features with no Frame equivalent, to preserve

- **SVG tab:** text-model SVG plus Recraft native vector, previews at 32/64/128, code view and copy, `.svg` save (`P:presentation/webview/components/views/SVGGenerationView.tsx`).
- **SVG attachments as Image-tab references** (both apps have these).
- **Prompt enhance** for image and SVG (ADR-003; `EnhanceHandler`, routed by `payload.type` at `P:presentation/webview/App.tsx:124-131`).
- **Token tracking** (`TOKEN_USAGE_UPDATE`, the AppHeader last-request line) and the OpenRouter balance strip from PR #12.
- **Save flow:** the `pixelMinion.outputDirectory` folder resolved with `vscode.Uri.joinPath`, which works for any workspace scheme; a save dialog when no workspace is open; open-after-save (`P:application/handlers/domain/ImageGenerationHandler.ts:229-282`).
- **Default image and SVG model pickers in Settings** (`P:…/views/SettingsView.tsx:77-89`).
- **Brand:** `--pm-*` tokens, "Pixel Minion" headers, and the "Curated by Pixel Minion" footer.

---

## 3. Should the SVG tab use the same picker, modes or transport?

1. **Picker: yes, and it already does** (`P:…/views/SVGGenerationView.tsx:94-100` uses `ModelSelector kind="svg"`). Keep a single picker. The change is to give SVG rows an explicit capability record instead of id-prefix heuristics. Frame's assessment proposes exactly this: `shared/models/SVGModels.ts` with explicit route capabilities (`F:docs/plans/pixel-svg-port-assessment.md:74`, F4 `:212`). **Recommended shape** [Inferred], using Frame's proposed file names so the code can move between the apps:

   ```ts
   // P:shared/models/SVGModels.ts
   interface SVGModelDefinition {
     id: string; displayName: string; description?: string;
     route: 'text-svg' | 'native-vector';
     textPricing?: { input: number; output: number };        // $/1M, text-svg only
     imagePricing?: ImagePricing;                            // unit 'image', native-vector only
     supportedAspectRatios?: readonly SVGAspectRatio[];       // P5b
     referenceImages?: { min: number; max: number };          // P5b
     supportsRefinement: boolean;                             // replaces startsWith('recraft/')
   }
   ```

   - The picker mapper `svgModelToBrowserOption` reuses Frame's `costPair` (`F:…/modelBrowserOptions.ts:360-365`) and `imagePricingLabel` (`:386-393`).
   - Pixel's 1k-input / 4k-output assumption moves out of the label and into a visible `costDescription`, following Frame's `approxBasis` pattern.
   - Pixel's SVG implementation then becomes the reference implementation of Frame's planned SVG port.

2. **Modes: not as a user toggle.** The route decides the policy.
   - Text SVG is conversational refinement over the full transcript.
   - Native vector is a one-shot generation; Pixel already disables Refine for it.
   - Frame warns not to infer conversational memory or SVG-as-reference acceptance from `input_references` (`pixel-svg-port-assessment.md:156,307`). A vector "Single Shot follow-up" that feeds back the latest SVG therefore stays disabled until a paid qualification.
   - Copy the *ownership discipline*, not the raster transcript semantics (`:281`): a dispatch snapshot, correlation, commit only successful turns, and a per-session in-flight guard.
   - Use the "Single Shot" wording only where the meaning really is the same.
3. **Transport: yes, move Recraft vector to `/images`. Use a dedicated adapter, not the raster stack.**
   - Frame records that current OpenRouter docs describe SVG output from `/api/v1/images` as `data[].b64_json` with `media_type: image/svg+xml`. The live records show 1:1, 4:3, 3:4, 16:9, 9:16 and auto, and 0–1 input references (`pixel-svg-port-assessment.md:149-156`).
   - Pixel's vector client still posts to chat and ignores the aspect ratio (`P:infrastructure/ai/clients/OpenRouterImageSVGClient.ts:51-64`). Its catalog says "1:1 only" (`P:infrastructure/ai/providers/OpenRouterProvider.ts:47-48`).
   - Implement `OpenRouterVectorSVGClient` with the Image API body shape and an **SVG-only** decoder. Do **not** route through `ImageOrchestrator` or widen `OpenRouterImageTransport.parseImages`'s raster allowlist (`F:…/OpenRouterImageTransport.ts:57`). Frame's design depends on raster MIME contracts staying narrow.
   - The aspect-ratio picker becomes driven by capabilities for vector rows; text SVG keeps Pixel's 7 viewBox ratios.
   - Frame's gate holds: refresh and qualify the route before enabling it (`:34`).

---

## 4. Pre-existing Pixel risks from Frame's assessment, checked at `57bab83`

| Frame ID | Verdict | Evidence in Pixel |
|---|---|---|
| **F1 HIGH**: generated SVG enters the app DOM; extraction is a tag regex | **CONFIRMED, and worse than described** | `P:presentation/webview/components/svg/SVGPreview.tsx:20-23` uses `dangerouslySetInnerHTML`. **Five** copies are rendered per result: inline `:151`, sized previews `:82` via `:159` ×3, full `:161` (`P:…/views/SVGGenerationView.tsx`). Validation is only regex extraction (`P:infrastructure/ai/orchestration/SVGOrchestrator.ts:199-215`); native-vector bytes are base64-decoded and passed through unvalidated (`OpenRouterImageSVGClient.ts:107-113`). **What is mitigated** [Observed CSP + Inferred browser behaviour]: `script-src 'nonce-…'` blocks inline `<script>` and `on*` handlers, and `default-src 'none'` with `img-src cspSource data: blob:` blocks external fetches (`P:application/providers/WebviewViewProvider.ts:132`). **What is not:** `style-src 'unsafe-inline'` lets a generated `<style>` restyle or hide the whole webview, including Settings and the API-key field, so the UI can be spoofed. Duplicate ids across the 5 copies break `url(#…)` references, and they can collide with the app's own SVG ids (`id="monitor-frame"`, `id="skull"` at `P:presentation/webview/App.tsx:68,76` and `P:…/layout/AppHeader.tsx:66,75,101`). [Inferred] `form-action` does not fall back to `default-src`, so a `<foreignObject>` form could submit off-site; this needs a spike. Saved `.svg` files keep any `<script>` and will run it if opened in a browser. **Fix:** isolated preview through `<img src="data:image/svg+xml;base64,…">` (CSP already allows `data:`), plus `SVGDocumentPolicy` (size, root, no script/handlers/foreignObject/external href) before display **and** before save |
| **F2 HIGH**: async and replay ownership | **CONFIRMED** | No correlation id on generate or continue (`P:presentation/webview/hooks/domain/useSVGGeneration.ts:178-189,216-229`). The response is applied unconditionally (`:123-142`), and `referenceSvgText` is read under `[]` deps, so it is stale (`:133,142`). The user message is appended before the provider call and never rolled back (`SVGOrchestrator.ts:113-124`), so a failed prompt is sent with the next refinement. Rehydration drops the raster reference (`P:infrastructure/ai/orchestration/SVGConversationManager.ts:207-220`). **Also found:** Refine eligibility uses the **draft** picker model (`SVGGenerationView.tsx:189`), while continuation routes by the thread's model (`SVGOrchestrator.ts:166-171`). A Recraft thread can therefore be "refined" after switching the picker to a text model, and the whole text transcript is sent to the vector client. Image-tab enhance errors also clear SVG loading (`App.tsx:151-154`) |
| **F3 HIGH**: save depends on VS Code; "Saved" is a one-second timer | **Timer CONFIRMED; VS Code dependency not a Pixel defect** | Timer at `SVGGenerationView.tsx:67-74`, and the same in the Image tab (`ImageGenerationView.tsx:82-94`). Cancel or error still ends with "Saved", because `handleSaveResult` only sets an error (`useSVGGeneration.ts:144-149`). Pixel is VS Code only, so the direct `vscode.*` save (`P:application/handlers/domain/SVGGenerationHandler.ts:217-274`) is a *portability* concern for Frame, not a Pixel risk. **Additional low-severity finding:** the webview-supplied `suggestedFilename` is joined unchecked with `Uri.joinPath(outputDirUri, filename)` (`:264`); `..` segments would escape the output folder. The webview sends a timestamp name today (`useSVGGeneration.ts:246-247`), so this is defence in depth |
| **F4 MEDIUM**: vendor-prefix routing and stale vector capabilities and prices | **CONFIRMED (one id has changed)** | `selectClient` uses `startsWith('recraft/')` (`SVGOrchestrator.ts:76-87`); the chat route sends no aspect ratio (`OpenRouterImageSVGClient.ts:59-64`); the catalog says "1:1 only" (`OpenRouterProvider.ts:47-48`). Frame's table lists `recraft/recraft-v4-vector`; at the PR #12 head the budget row is `recraft/recraft-v4.1-vector`, so re-qualify that id specifically. The SVG aspect selector is shown for Recraft but ignored |
| **F5 MEDIUM**: App error fallback and spend allowlist | **Mostly N/A** | The spend allowlist is Frame-specific; Pixel refreshes from `applyTokenUsage`, which the SVG handler receives (`P:application/handlers/MessageHandler.ts:106-111,151`). The error-routing part partly applies: enhance and default errors go to both hooks (`App.tsx:151-158`) |
| **F6 LOW**: tab order and Gallery | **N/A** | Frame-only |
| *(not in Frame's list)* Markdown rendered without sanitizing | **Dormant** | `P:presentation/webview/components/common/MarkdownRenderer.tsx:5,28,38` claims to sanitize, but `marked` output is inserted raw. It is used only by the unmounted `HelloWorldView`. Remove it or sanitize before anyone reuses it |

---

## 5. Phasing: independently reviewable PRs for Astra

Preconditions: PR #12 (design system) merges, then the design-fixup PR stacks on it.

Each PR below is designed to be **releasable without a regression**; this drives the boundaries. Every PR updates Pixel's `docs/CHANGELOG-DETAILED.md`, adds a `docs/plans/frame-image-parity.md` ledger row, and gives each copied file a provenance header: `// Ported from frame-minion@40e7949 packages/core/src/<path>; keep in sync`.

| PR | Scope | Main files | Tests to port or write | Acceptance | Depends on | Size |
|---|---|---|---|---|---|---|
| **P1: Shared catalog and picker that looks the same** | Move catalogs to `P:shared/models`; unit-aware `ImagePricing`; Frame's picker components; SVG catalog type with `route` and pricing. **No wire changes and no new models** | See §6 | Frame `ModelBrowserModal.test.tsx` (7), `ModelBrowserSelect.test.tsx` (2), `modelBrowserOptions.test.ts` "image pricing labels" block (`:146-262`, limited to Pixel's 34 rows), label/provider normalization cases; new SVG mapper tests; keep Pixel's "every model has a release date" test | Three pivots including release date; Frame's card anatomy with a visible `costDescription`; GPT Image 2 shows `≈ $0.211 \| image @ 1K · high`; no `startsWith(` left in `modelBrowserOptions.ts`; single-line trigger; checked at 360 px in dark, light and high contrast in an installed VSIX | design-fixup | M |
| **P2: Request ownership hardening** (live bugs, before modes) | Correlation ids for generate, continue, enhance and clear in **both** hooks; correlated error handling; send SVG reference text once; continuation stops sending draft references/SVG; memoize `persistedState`; orchestrator rollback, in-flight guard and first-turn release; manager deep clone; WebP/GIF extensions; "Saved" state set from the real result | `P:…/hooks/domain/useImageGeneration.ts`, `useSVGGeneration.ts`, `App.tsx`, `ImageOrchestrator.ts`, `ImageConversationManager.ts`, `SVGOrchestrator.ts` (rollback only), `ImageGenerationHandler.ts` (extension), both views (save state) | Adapted from Frame `ImageConversationModes.test.ts:120` (rollback), `:203` (first turn), `:163` (single provider call under concurrency); hook "captures prompt/context once and ignores stale responses and errors" (`useImageGenerationModes.test.tsx:41`, without modes); new: SVG text sent once, `.webp` save, `persistedState` stays referentially equal while idle | A late or stale response cannot settle; an enhance error cannot stop another tab's spinner; a failed turn is absent from the next request body; cancelling a save never shows "Saved" | PR #12 (independent of P1) | S–M |
| **P3: Image API transport and capability-driven controls** (the engine) | Port capabilities, the two transports, mode-aware client, manager, orchestrator, host transcript store and Pixel `FileSystem`/`Workspace` ports; thread-owned settings (the mode is **chosen automatically for each new thread** using Frame's default rule: Conversation if a verified route exists, otherwise Single Shot; no toggle yet); resolution, aspect (with `auto`), seed, reference controls and normalization; natural-dimension card; bounded persistence; add the 20 new rows and metadata | Host: `shared/models/{ImageGenerationModes,ImageModels}.ts`, `shared/types/{providers,messages/imageGeneration,messages/svgGeneration}.ts`, `infrastructure/ai/clients/{OpenRouterImageTransport,OpenRouterImageClient,ImageGenerationClient}.ts`, `infrastructure/ai/orchestration/{ImageOrchestrator,ImageConversationManager,ImageConversationStore}.ts`, `platform/{FileSystem,Workspace}.ts`, VS Code adapters, `extension.ts`, `WebviewViewProvider.ts`, `MessageHandler.ts`, `ImageGenerationHandler.ts`, SVG type rename. Webview: `useImageGeneration.ts`, `imageHistoryPersistence.ts`, `AspectRatioSelector`, `ResolutionSelector`, `ImageUploader`, `ImageCard`, `ConversationThread`, `ImageGenerationView` and CSS | Frame `OpenRouterImageClient.test.ts` (drop `:134` custom project ratio), `ImageGenerationModes.test.ts` plus the `openrouter-image-chat-routes-2026-09-10.json` fixture, `ImageConversationModes.test.ts` (drop `:180` legacy mv-frame), `ImageConversationManager.test.ts`, `useImageGeneration.test.ts` normalization block, `imageHistoryPersistence.test.ts` (drop the desktop half of `:51`), hook test "continues with immutable thread settings" (`:33`), "clears optimistic settings after a failed new thread" (`:113`). Replace Pixel's prefix-modality tests (`P:__tests__/infrastructure/ai/clients/OpenRouterImageClient.test.ts:58-95`) | Single Shot sends an `/images` body (prompt, `input_references`, ratio/resolution omitted when unverified); Conversation sends the full chat history plus `image_config`; Muse uses chat in both; no endpoint retry; transcript written under `globalStorage/image-conversations/<hash>/img-*.json` within 64 MiB; Conversation continues after an extension-host restart; a mismatch gives an explicit error; unsupported ratio/resolution/reference counts are rejected before any provider call; WebP output saves as `.webp` | P1, P2 | L |
| **P4: Mode toggle and threads** | Conversation \| Single Shot radio; Earlier threads plus Delete thread (tombstone); start a new thread from an image; custom-id policy (permissive Single Shot, strict Conversation, id visible); picker list filtered by mode; endpoint copy; "Start Conversation" / `submitLabel`; text-only gating; untagged history opens as Single Shot | `useImageGeneration.ts`, `ImageGenerationView.tsx`, `ModelSelector.tsx`, `ConversationThread.tsx`, `ImageCard.tsx`, `ContinueChatInput.tsx`, `image-generation-view.css` (mode pill, `--fm-*` → `--pm-*`) | Frame `useImageGenerationModes.test.tsx` (`:20,59,75,87,100,125,133,139,156`), `imageHistoryPersistence.test.ts:11` (five archives), store clear/tombstone (`ImageConversationModes.test.ts:148`) | Frame's manual smoke list (`image-conversation-edit-modes.md:100-110`), minus the MVO and desktop rows | P3 | M |
| **P5a: SVG safety and ownership** (recommended **early**: can follow the design-fixup PR, ideally before P3) | Isolated `<img>` preview; `SVGDocumentPolicy` for preview and save; route/ownership snapshot; refine eligibility from the thread's model | `components/svg/SVGPreview.tsx`, `[+] infrastructure/svg/SVGDocumentPolicy.ts`, `useSVGGeneration.ts`, `SVGOrchestrator.ts`, `SVGConversationManager.ts` (replay keeps the reference), `SVGGenerationView.tsx`, `SVGGenerationHandler.ts` (basename-only filename) | Hostile-SVG fixtures (style leak, duplicate ids, script, foreignObject, external href); race and replay tests per Frame's quality scenarios (`pixel-svg-port-assessment.md:178-185`) | App styles unchanged with a hostile `<style>`; CSS/SMIL animation still plays in the preview (manual check in a real host); rejected source stays visible in the code view | P2 (shared correlation pattern) | M |
| **P5b: Native vector over `/images` and SVG capabilities** | `OpenRouterVectorSVGClient` (SVG-only decoder); capability-driven vector ratios and references; `supportsRefinement`; refreshed prices | `[+] infrastructure/ai/clients/OpenRouterVectorSVGClient.ts`, `shared/models/SVGModels.ts`, `MessageHandler.ts`, SVG aspect selector | New wire tests against a fixture snapshot of the two Recraft vector endpoint records | Vector request carries `aspect_ratio`; raster allowlist untouched; paid smoke check (needs owner approval) before enabling | P3 (pricing and conventions), P5a | M |

**Can the picker "look the same" before the rest?** [Inferred] Yes, but only if P1 includes the unit-aware `ImagePricing` data (`approxUsdPerImage`, `approxNote`, `approxBasis`) and Frame's metadata table.
- The appearance does **not** need the capability fields (ratios, resolutions, references) or modes.
- *Behaviour* parity arrives later:
  - the mode-filtered model list (`F:…/views/ImageGenerationView.tsx:66`);
  - the custom/unavailable helper text;
  - the 20 newer models.

  These come with P3/P4. Until P4, Pixel's list equals Frame's Single Shot list (every catalog row qualifies for `edit`).
- **Must ship together:**
  - P3 host and webview: explicit modes make the host strict about ratios, so old controls would trigger new pre-dispatch rejections.
  - The transcript store with P3: otherwise Conversation threads lose restart recovery, which Pixel has today in a lossy form.
  - Bounded persistence with archives (P3/P4): F-6.

Effort total [Inferred]: P1 M, P2 S–M, P3 L, P4 M, P5a M, P5b M. Roughly 18–26 engineering days, plus review and paid validation.

---

## 6. Phase 1, file by file

**Goal:** Pixel's model picker (Image tab, SVG tab, Settings) looks and behaves like Frame's, using correct unit-aware prices. No change to wire messages or which models generate.

### Catalog and types

- `[+] P:shared/models/ImageModels.ts`
  - Frame's header comment and the 34 rows Pixel already ships, copied **verbatim with only** `id`, `displayName`, `description`, `imagePricing` (from `F:core/shared/models/ImageModels.ts:51-145`).
  - Capability fields and `ASPECT_RATIOS` are deferred to P3. Copying them now would pull in the widened `AspectRatio` type and its SVG ripple, and would leave fields that nothing reads.
  - `DEFAULT_IMAGE_MODEL = 'google/gemini-3.1-flash-image'`.
  - This adopts Frame's newer rates (MAI input $8; Grok without an input rate) and the `⭐ … - Recommended` names (Frame's names include "Google:" and "Microsoft:" prefixes; this changes labels and families).
- `[+] P:shared/models/SVGModels.ts`
  - `SVGModelDefinition` as in §3, with only `route`, `textPricing`/`imagePricing` and `supportsRefinement` in P1.
  - Move `OPENROUTER_SVG_MODELS` and `DEFAULT_SVG_MODEL` here.
  - Recraft rows get `imagePricing: { unit: 'image', output: 0.30 | 0.08, approxBasis: 'Published per-image price…' }`; text rows keep $/1M.
- `[+] P:shared/models/index.ts`: barrel, as in Frame's `F:core/shared/models/index.ts`.
- `[~] P:shared/types/providers.ts`: add `ImagePricingUnit`, `ImagePricing` (verbatim from `F:core/shared/types/providers.ts:51-87`) and a P1 subset of `ImageModelDefinition`; remove `inputCost`/`outputCost` from image rows. Optionally drop the import from infrastructure (`:8`) as Frame did with `ProviderTextClient`, which removes a webview typecheck dependency on infrastructure.
- `[~] P:infrastructure/ai/providers/OpenRouterProvider.ts`: becomes an infrastructure config that re-exports from `../../../shared/models`, as in Frame's `F:core/infrastructure/ai/providers/OpenRouterProvider.ts`.
- `[~]` Point catalog imports at `@shared/models`:
  - `P:presentation/webview/components/views/ImageGenerationView.tsx:18`
  - `SVGGenerationView.tsx:19`
  - `SettingsView.tsx:14-16`
  - `hooks/domain/useImageGeneration.ts:21`
  - `useSVGGeneration.ts:19`
  - the test at `P:__tests__/presentation/webview/modelBrowserOptions.test.ts:2-5`

### Picker components

- `[~] P:presentation/webview/components/shared/ModelBrowserModal.tsx`: replace it with Frame's `F:…/components/shared/ModelBrowserModal.tsx:1-337`, then re-apply:
  - `autoFocus` on search;
  - clear the query when the modal closes;
  - `role="dialog"` on the panel and `role="presentation"` with `onMouseDown` on the backdrop;
  - a `footerLabel` prop (default "Curated by Pixel Minion").

  Types move back into this file, as in Frame.
- `[−] P:…/shared/modelBrowserTypes.ts`: delete, or keep as a one-line type re-export during the transition. Update `P:…/shared/index.ts`.
- `[~] P:…/shared/ModelBrowserSelect.tsx`: Frame's `F:…/ModelBrowserSelect.tsx` (label, chevron SVG, `helperText`, `loadingLabel`, `Custom:` fallback), plus `aria-haspopup="dialog"`. Remove `compact` and the sub-line.
- `[~] P:…/shared/modelBrowserOptions.ts`:
  - **Copy verbatim from Frame:** `PROVIDER_LABELS`, adding `krea: 'Krea'` and `qwen: 'Qwen'` and upstreaming both; `IMAGE_MODEL_METADATA` (dates match Pixel's for all 34 overlapping ids [Observed by scripted comparison]); `providerFromId`, `familyFromLabel`, `stripRecommended`, `costPair`, `formatUsd`, `imageNativePricingLabel`, `imagePricingLabel`, `imagePricingDescription`, `imageUnitBadgeLabel`, `recommendedBadge`, `modelDefinitionToBrowserOption` (`F:…/modelBrowserOptions.ts:14-448`, without the text and video metadata).
  - **Pixel-only:** `SVG_MODEL_METADATA` (Pixel's 9 SVG rows from `P:…/modelBrowserOptions.ts:59-67`) and `svgModelToBrowserOption(model: SVGModelDefinition)`:
    - badge `native SVG` or `SVG code` from `route`;
    - `costLabel` from `imagePricingLabel` (render "| SVG" in place of "| image") or `costPair`;
    - `costDescription` carrying the 1k/4k-token assumption.
  - Remove `modelToBrowserOption`, `nativeCost` and `estimateCost`.
- `[~] P:…/components/image/ModelSelector.tsx`: Frame's version (`models`, `selectedModel`, `onModelChange`, `disabled`, `unavailableLabel`, custom row), with a Pixel subtitle prop. Frame's subtitle mentions a frame, which is wrong for Pixel.
- `[~] P:…/views/SVGGenerationView.tsx:94-100` and `SettingsView.tsx:77-89`: use the new mappers. The SVG view can call `ModelBrowserSelect` directly with `svgModelToBrowserOption`.

### Styles

- `[~] P:…/styles/components/model-browser.css`: start from Frame's `F:…/styles/components/model-browser.css` and keep Pixel's `--mb-*` → `--pm-*` alias block (Pixel `:16-29`).
  - Bring over:
    - 3-column pivots;
    - `.model-browser-badge.warn`;
    - `.model-browser-desc` spacing;
    - `.model-browser-helper`;
    - `.provider-highlight`;
    - Frame's single-line trigger;
    - the `100dvh` fallback;
    - cost `max-width: 124px`. Frame's labels are short; Pixel's 220 px was needed for its combined labels.
  - Pixel has no `--pm-accent-soft` or `--pm-btn`; keep the `color-mix` fallback.
- `[~] model-selector.css`: only if the trigger relies on it.
- Coordinate with the design-fixup PR so it does not restyle the trigger back.

### Test infrastructure

- `[~] P:../jest.config.js`:
  - `testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx']`
  - `'\\.(css|less|scss|sass)$': '<rootDir>/src/__tests__/styleMock.js'`
  - `globals: { 'ts-jest': { tsconfig: 'tsconfig.test.json' } }`
- `[+] P:../tsconfig.test.json`: extends `tsconfig.json`, adds `jsx: react-jsx`, the DOM libs and `allowSyntheticDefaultImports`, and includes `src/**/*.ts(x)`. The base config excludes `src/presentation/webview`, so the include must override it.
- `[+] P:__tests__/styleMock.js`: `module.exports = {};`

### Tests

- `[+] __tests__/presentation/webview/components/shared/ModelBrowserModal.test.tsx`: Frame's 7 cases; replace "Curated by Frame Minion" assertions.
- `[+] …/ModelBrowserSelect.test.tsx`: Frame's 2 cases.
- `[~] __tests__/presentation/webview/modelBrowserOptions.test.ts`: replace the 1,290-token assertions with Frame's pricing block (`F:core/__tests__/presentation/webview/components/shared/modelBrowserOptions.test.ts:146-262`, filtered to rows present), plus SVG mapper cases: native-vector label and basis, text-SVG basis, route badges, and the release-date guard over both catalogs.

### Documentation

- `[+] docs/plans/frame-image-parity.md`: this matrix as a living ledger.
- `docs/CHANGELOG-DETAILED.md` entry.
- Public `CHANGELOG.md`: corrected cost estimates and a richer model browser.

### Phase 1 risks

- [Inferred] Display names and families change (for example "Nano Banana 2 (Google: …)", and FLUX grouped as "FLUX.2"), so users will see different group chips.
- Higher estimates for GPT models are a correction, not a regression; say so in the changelog.

---

## 7. Open decisions and validation the owner holds

1. **Trigger design:** adopt Frame's single-line trigger (recommended, because the brief says "look the same"), or upstream Pixel's two-line estimate trigger to Frame instead.
2. **Save path:** keep Pixel's `vscode.Uri` save (recommended, keeps virtual-workspace saves) or converge on Frame's port-based `saveImage`, which only uses `file://` folders and otherwise opens a dialog. Record the delta either way.
3. **Order of P5a:** recommended immediately after the design-fixup PR, because F1 is HIGH; Frame requires the isolated preview before enabling SVG (`pixel-svg-port-assessment.md:34`).
4. **Re-audit before P3:** Frame's catalog, prices and chat-route fixtures date from 2026-09-10 and 2026-10-02. Re-run the unauthenticated `GET /api/v1/images/models` and per-model `/endpoints` calls and the chat-route snapshot.
5. **Paid and installed-host checks not covered by tests:**
   - Gemini 4K in Conversation, with a reload between turns 2 and 3.
   - Muse in both modes.
   - Signed vs unsigned replay (F-11).
   - The new `/images`-only rows.
   - Recraft vector over `/images`.
   - Animated SVG in the `<img>` preview.
   - The 360 px sidebar in high contrast.

   Each needs explicit owner approval to spend credits.
6. **Shared follow-ups to propose upstream to Frame:**
   - Honest "Saved" state.
   - Modal focus trap and focus return.
   - `footerLabel` prop and the Pixel a11y changes.
   - Release dates for the 5 rows that have none.
   - Retention of transcripts and tombstones (F-7/R-4), which both apps inherit.

---

## 8. P3 as built (2026-11-12)

**Status:** ✅ Implemented on `claude/pixel-minion-images-transport-dhbqpd` (`19136ad`, `cfb0d34`, `a501ad5`), from `main` at `035906f`. Awaiting review.

The P3 row of §5 was planned against Pixel `57bab83`. By the time P3 started, PR B had already moved the catalogs to `src/shared/models`, ported Frame's unit-aware `ImageModelDefinition` with every capability field, and fixed the picker; P2 had added correlation ids, rollback and the in-flight guard. So P3 is mostly the engine and the controls. The P4 items (toggle, archives, start-from-image, Settings custom ids) are untouched, except the two P3 can't ship without: untagged history migrates to Single Shot, and a custom id runs as Single Shot.

### Status by item (parity matrix rows touched)

| Row | Item | Status |
| --- | --- | --- |
| 2 | Two transports, mode-aware client | ✅ `cfb0d34`. Muse is out of both modes (no route on 2026-11-12) |
| 3 | Capability resolution | ✅ `cfb0d34` (`ImageGenerationModes.ts`) |
| 4 | Aspect ratios incl. `auto`; SVG keeps its seven | ✅ `19136ad`, `cfb0d34` |
| 5 | Resolution tiers | ✅ `cfb0d34` |
| 6 | Seed only where supported | ✅ `cfb0d34` |
| 7 | Reference min/max and MIME, UI and host | ✅ `cfb0d34`; witnesses in `a501ad5` |
| 8 | Normalization when an option disappears | ✅ `cfb0d34` |
| 9 | Thread-owned settings + migration | ✅ `cfb0d34` (migration done here, not P4: P3 can't continue an untagged thread otherwise) |
| 12 | Host transcript store, restart recovery | ✅ `cfb0d34` (`GlobalStorage` seam instead of Frame's ports) |
| 13 | Bounded persistence | ✅ `cfb0d34` without archives (P4) |
| 16 | MIME detection, natural dimensions | ✅ `cfb0d34` |
| 21 | Text-only models | ✅ `cfb0d34` |
| 25 | Catalog breadth | ✅ 35 → 54 rows |
| 1, 10, 11, 20, 22 | Mode toggle, archives, start-from-image, custom ids in Settings, mode copy | ⏳ P4 |

### Ported vs adapted

- **Verbatim (modulo imports and comments):** `ImageConversationManager`, `OpenRouterImageTransport` (chat and Image API adapters), `OpenRouterImageClient`'s preflight and parsing, `ImageOrchestrator`'s mode, settings and recovery logic, `FileImageConversationStore`'s validation and limits, `imageHistoryPersistence`'s bound, `AspectRatioSelector`, `ResolutionSelector`, `ImageUploader`'s limits.
- **Adapted:**
  - Conversational set from the 2026-11-07 probe (re-run 2026-11-12), not Frame's 2026-09-10 list: adds Nano Banana 2.1; drops Muse.
  - Conversation carries the model's audited reference bounds (Frame: unbounded).
  - The store writes through `GlobalStorage` (`size` / `read` / `write`, mkdir-p) over `context.globalStorageUri`, not Frame's `FileSystem` / `Workspace` ports.
  - Raster sniffing reuses `shared/media/imageFormats` (also the save handler's).
  - The orchestrator keeps P2's fuller rollback (turn number and last images too).
  - Generate releases the thread it replaces (`IMAGE_GENERATION_CLEAR`): P3 has no archive, so the thread can't be reached again, and its transcript would otherwise be orphaned.
  - Mode is derived from the model until P4's toggle (`defaultImageMode`, Frame's rule, named).
  - The image card prefers natural dimensions over the requested ratio (Frame: requested first).
  - The persistence bound has no desktop budget and no archives.
  - The chat client keeps Pixel's signature diagnostics in its debug log.
- **Not ported:** project-frame helpers and MVO seams, the desktop budget, the image card's video/orchestrator actions, Frame's `TERMINAL_AI_RESPONSE_TYPES` (Pixel already arms the balance refresh that way).

### Acceptance (§5 row P3)

| Criterion | Evidence |
| --- | --- |
| Single Shot sends an `/images` body; ratio/resolution omitted when unverified | `OpenRouterImageClient.test.ts`; live I1/I2 |
| Conversation sends the full history plus `image_config` | `OpenRouterImageClient.test.ts`, `ImageConversationModes.test.ts`; live J1/J2 |
| No endpoint retry | client tests for both transports |
| Transcript under `globalStorage/image-conversations/<hash>/img-*.json` within 64 MiB | `ImageConversationModes.test.ts` |
| Conversation continues after an extension-host restart; a mismatch errors explicitly | `ImageConversationModes.test.ts`, `imageTabRoutes.test.tsx`; live J2 |
| Unsupported ratio, resolution or reference count rejected before any provider call | client, orchestrator and end-to-end tests |
| WebP output saves as `.webp` | P2's save tests, unchanged; the transport keeps the sniffed type |
| (Muse uses chat in both modes) | Not applicable: Muse has no route |

### Manual checks still owed (owner-run)

The key's workspace is BYOK-restricted, so the live run reached only OpenAI (audit addendum 2). Still owed:
- Gemini Conversation at 4K with a reload between turns 2 and 3, and signed vs unsigned replay (F-11).
- One call each through `/images` for FLUX.3, Qwen, Krea (K3 Edit with a reference) and Recraft (V4.1 Flash with and without a reference).
- The installed-VSIX pass at 360 px in Dark, Light and High Contrast.

### Inherited limitations (documented, not fixed)

F-7 (each Conversation turn rewrites its whole transcript; no expiry; tombstones stay), F-10 (reloading mid-generation strands the Conversation; the next follow-up fails with "visible history differ"), F-11 (the latest image is a user reference even when signed assistant images are replayed, so it is billed twice), R-4 (deleting an unknown Single Shot id after a restart writes a small tombstone). Also observed in the live run: GPT-5 Image Mini ignored a chat `aspect_ratio` once; BYOK turns report `cost: 0`.
