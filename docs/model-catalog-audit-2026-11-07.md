# Model Catalog Audit — 2026-11-07 (Pixel Minion)

**Repo state audited:** this repository on `claude/pixel-minion-design-review-dhbqpd` (= draft PR #12 head; catalog last curated in `38bd8ac`, 2026-07-27, input costs touched in `e7587b7`). **Scope:** `OPENROUTER_IMAGE_MODELS` (34) and `OPENROUTER_SVG_MODELS` (9) in `src/infrastructure/ai/providers/OpenRouterProvider.ts`; defaults in `package.json`, `SettingsHandler.ts`, `useSettings.ts`; label rendering in `modelBrowserOptions.ts`; reconciliation with Frame Minion's sprint-06 image catalog (`feat/video-models-sprint-06`, read-only worktree).

Every figure below comes from a public OpenRouter snapshot captured on 2026-11-07 (`raw/…` names refer to those snapshots; they are not committed — re-capture them with the refresh procedure at the end). Nothing was purchased; no API key was used. Where a number is derived, the derivation is stated next to it.

---

## 0. Urgent findings

| # | Severity | Finding | Evidence | Action |
|---|---|---|---|---|
| U1 | 🔴 | **`anthropic/claude-opus-5-fast` is delisted.** Absent from `/api/v1/models`. Its endpoints record returns **0 endpoints**. Selecting it in the SVG tab fails at request time. | `raw/models.json`, `raw/chat-endpoints/anthropic_claude-opus-5-fast.json` | Remove it from `OPENROUTER_SVG_MODELS`. Migrate saved `svgModel` values to `anthropic/claude-opus-5.5`. The "fast" lane now exists only as the `anthropic/fast` provider tag on Opus 5 ($10/$50) and Opus 5.5 ($8/$40). |
| U2 | 🔴 | **`x-ai/grok-imagine-image-quality` is delisted.** It is missing from `/api/v1/images/models`. The Image API endpoint returns 404 "No image model found". The chat endpoints record lists **0 endpoints**. Frame sprint-06 still ships this id too. | `raw/images-models.json`, `raw/grok-imagine-image-quality.chat-endpoints.json` | Remove it from both catalogs. Migrate saved `imageModel` values to `x-ai/grok-imagine-image-2.0`. |
| U3 | 🔴 (unverified) | **The transport mismatch may break the default SVG model and about 28 image entries.** Pixel sends every image and native-vector request to `POST /api/v1/chat/completions`. The live `/api/v1/models?output_modalities=image` feed publishes each model's supported API paths. Only the Gemini image family (including Nano Banana 2.1), `openai/gpt-5.4-image-2`, `gpt-5-image`, `gpt-5-image-mini` and `meta/muse-image` list `/api/v1/chat/completions`. **Every Recraft model (including the default `recraft/recraft-v4.1-pro-vector`), FLUX, Krea, Riverflow, Seedream, Qwen, MAI and all `openai/gpt-image-*` models list only `/api/v1/images`.** OpenRouter's image-generation guide now documents only the dedicated `POST /api/v1/images` API. Frame sprint-06 reached the same conclusion on 2026-09-10 ("A catalog listing for an image generator alone does not establish a conversational route"): it routes these models through `/images` and keeps chat for Gemini, the GPT-5 wrappers and Muse. *Counter-evidence:* `/api/v1/models/<id>/endpoints` still returns one provider record for `recraft-v4.1-pro-vector`, `flux.2-pro` and `gpt-image-2.6-sunburst`. An unauthenticated probe returns 401 before routing. **I could not prove either way.** | `raw/models-output-image.json`, `raw/docs-image-generation.md`, `raw/chat-routes/*.json`, Frame `ImageGenerationModes.ts` | Run a **keyed smoke test today**: one cheap generation each through Pixel's current path for `recraft/recraft-v4.1-vector` ($0.08), `black-forest-labs/flux.2-klein-4b` (~$0.014) and `openai/gpt-image-1-mini`. If any fails, adopt Frame's transport split (§4.3). That would also fix U4. |
| U4 | 🟠 | **The code routes on id prefixes, and some entries likely get wrong modalities.** `OpenRouterImageClient.getModalitiesForModel` sends `['image','text']` to anything outside its allowlist. `krea/*` and `microsoft/mai-image-*` are already in the catalog but output image only. The in-code comment says "Image-only endpoints reject ["image","text"]". The new prefixes `qwen/`, `meta/` and `tencent/` would hit the same branch. The `recraft/recraft-v4.1*` special case sends `['image','text']`, but live `output_modalities` is `['image']` for every Recraft model. Frame's chat client has the same code. | `OpenRouterImageClient.ts:217-238`, `raw/images-models.json` | Include these in the U3 smoke test. Derive modalities from catalog data rather than id prefixes (Frame's `ImageRouteCapabilities.modalities`). |
| U5 | 🟠 | **`openai/gpt-5-image-mini` expires 2026-12-01** (`expiration_date` in the chat feed). Its chat endpoint, and that of `gpt-5.4-image-2`, report `status: -5`. Frame's 2026-09-10 fixture shows `0`; the meaning of the value is undocumented. | `raw/models.json`, `raw/chat-routes/openai__gpt-5-image-mini.json` | Remove it, or label it "retiring Dec 1", before 2026-12-01. |
| U6 | 🟡 | **GPT-5.6 Sol and Sol Pro prices drifted.** The catalog says $5/$30. Live is **$4/$20** on the `openai` and `azure` endpoints (flex $2/$10, fast $8/$40). | `raw/chat-endpoints/openai_gpt-5.6-sol*.json` | Fix, or supersede them with GPT-6.1 Sol (§2). |

---

## Sources

All sources are public and unauthenticated. Snapshots were taken 2026-11-07 between 15:42 and 15:56 UTC.

| Source | What it provides | Snapshot |
|---|---|---|
| `GET https://openrouter.ai/api/v1/images/models` | 63 image models: capabilities superset, `created` | `raw/images-models.json` (sha256 `d84a2526…`) |
| `GET …/api/v1/images/models/<id>/endpoints` ×63 | **Definitive** per-endpoint `supported_parameters` and pricing `[{billable, unit, cost_usd, variant?}]` | `raw/endpoints/*.json` |
| `GET https://openrouter.ai/api/v1/models` | 460 chat-feed models: text pricing, `input_modalities`, `reasoning`, `expiration_date`, API paths | `raw/models.json` (`493b9898…`) |
| `GET …/api/v1/models?output_modalities=image` | 66 image-output models, with **per-model API paths** (`/api/v1/images` vs `/chat/completions`). Note: its `pricing` block for /images-only models is a *synthetic normalization* (e.g. Recraft $0.30/image ÷ 4,175 pseudo-tokens). Never read native prices from it. | `raw/models-output-image.json` (`6adb79cf…`) |
| `GET …/api/v1/models/<id>/endpoints` | Chat-route provider records: SVG text candidates, current entries, image chat routes | `raw/chat-endpoints/`, `raw/chat-routes/` |
| `https://openrouter.ai/docs/features/multimodal/image-generation.md` | Image API contract: `aspect_ratio`, `resolution`, `output_format: svg`, `input_references` | `raw/docs-image-generation.md` |
| OpenRouter API reference: chat completions, generate image | `modalities`, `image_config` (still documented for chat), Images API request/response | `raw/api-chat-completions.md`, `raw/api-generate-image.md` |
| `https://openrouter.ai/benchmarks/media/images/*` (16 pages) | **Measured** per-image `costUsd`, output size, and LLM-judged check pass rates. 1,154 cells, 62 models: 11 text-to-image prompts × 14 cells plus 5 edit prompts × 7 cells per model. | `raw/bench/*.html` → `raw/bench-measured-2026-11-07.json`, `raw/bench-summary-by-model-2026-11-07.json` |
| OpenRouter model pages | Muse's published "$0.01/image" (reconfirmed) | `raw/pages/` |
| Frame sprint-06 `ImageModels.ts`, `providers.ts`, `ImageGenerationModes.ts`, `docs/research/image-price-estimates.md`, chat-routes fixture (2026-09-10) | Reconciliation baseline | `raw/frame-sprint06-catalog.json` (parsed by `scripts/frame_catalog_to_json.js`) |

Derived artifacts (scripts live in `scripts/`):
- `raw/live-capabilities-2026-11-07.json`: per-model capabilities from per-endpoint records. A capability is kept only if **every** endpoint advertises it.
- `raw/live-capabilities-compact.txt`: one line per model.

⚠️ **Blocked sources:** `ai.google.dev` and `developers.openai.com` were refused by the egress proxy. Nano Banana 2.1 and GPT Image 2.6 therefore have **no vendor-documented per-image token counts** in this audit. Their estimates are either measured (benchmark) or omitted.

⚠️ **Benchmark caveat:** OpenRouter runs these benchmarks. The checks are judged by LLMs. The harness's quality and resolution settings are **not published per cell**. Treat costs as observed data points, not quotes, and pass rates as a coarse signal, not a ranking.

---

## 1. Image catalog (`OPENROUTER_IMAGE_MODELS`, 34 entries)

### 1a. Current-entry verification

Price is native and lowest-tier. ✓ means the stored output price matches live. **API** shows the paths listed in the live feed: `C` = chat/completions + images, `I` = `/api/v1/images` only. *Pixel ARs unsupported* lists which of Pixel's 7 ratios the endpoint does not advertise; providers "clamp to their supported subset" per the docs. **Measured** is the benchmark t2i median at 1024² unless noted.

| id | Stored in/out | Live native pricing | Unit | Refs | Pixel ARs unsupported | API | Measured | Verdict |
|---|---|---|---|---|---|---|---|---|
| google/gemini-3.1-flash-image | 0.5/60 | out $60/1M img tok (vertex/us $66); text prompt $0.5/1M (chat feed) | image-token | 0–14 | — | C | $0.0684 | ✓ |
| google/gemini-3.1-flash-image-preview | 0.5/60 | out $60/1M | image-token | 0–14 | — | C | $0.0686 | ✓ |
| google/gemini-3-pro-image | 2/120 | in $2 / out $120 per 1M | image-token | 0–14 | — | C | $0.1357 | ✓ (4K only on ai-studio endpoint) |
| google/gemini-3-pro-image-preview | 2/120 | $2/$120 (flex endpoint $1/$60) | image-token | 0–14 | — | C | $0.1359 | ✓ |
| google/gemini-3.1-flash-lite-image | 0.25/30 | out $30/1M; prompt $0.25 | image-token | 0–14 | — | C | $0.0336 | ✓ |
| google/gemini-2.5-flash-image | 0.3/30 | in $0.3 / out $30 | image-token | 0–3 | — | C | $0.0387 | ✓ |
| openai/gpt-image-2 | —/30 | **in-img $8, in-text $5**, out $30 | image-token | 0–16 | — | **I** | $0.0186 | ✓ out; input missing |
| openai/gpt-image-1 | —/40 | **in-img $10, in-text $5**, out $40 | image-token | 0–16 | 4:3, 3:4, 16:9, 9:16 | **I** | $0.1667 | ✓ out; input missing |
| openai/gpt-image-1-mini | —/8 | **in-img $2.5, in-text $2**, out $8 | image-token | 0–16 | 4:3, 3:4, 16:9, 9:16 | **I** | $0.0334 | ✓ out; input missing |
| openai/gpt-5.4-image-2 | —/30 | in-img $8, out $30 (chat text $8/$15) | image-token | 0–16 | — | C | $0.0188 | ✓ (chat status −5) |
| openai/gpt-5-image | —/40 | in-img $10, out $40 | image-token | 0–16 | 4:3, 3:4, 16:9, 9:16 | C | $0.1670 | ✓ |
| openai/gpt-5-image-mini | —/8 | in-img $2.5, out $8 | image-token | 0–16 | 4:3, 3:4, 16:9, 9:16 | C | $0.0334 | ⚠️ **expires 2026-12-01** |
| microsoft/mai-image-2.5-pro | 5/108 | in-text $5, **in-img $8**, out $108 | image-token | 0–1 | — | **I** | $0.1109 | ✓ out; stored input is the *text* rate, labelled "image tokens" |
| microsoft/mai-image-2.5 | 5/47 | in-text $5, **in-img $8**, out $47 | image-token | 0–1 | — | **I** | $0.0484 | same |
| krea/krea-2-large | —/0.06 | $0.06 (+$0.005 style-ref / +$0.01 moodboard variants) | image | 0–1 | 3:4 | **I** | $0.06 | ✓ (now API-published; Frame's "no API pricing" comment is stale) |
| krea/krea-2-medium | —/0.03 | $0.03 (+variants) | image | 0–1 | 3:4 | **I** | $0.03 | ✓ |
| krea/krea-2-medium-turbo | —/0.015 | $0.015 (+variants) | image | 0–1 | 3:4 | **I** | $0.015 | ✓ |
| black-forest-labs/flux.2-klein-4b | —/0.014 | $0.014/MP | megapixel | 0–4 | — | **I** | $0.014 | ✓ |
| black-forest-labs/flux.2-pro | —/0.03 | $0.03/MP | megapixel | 0–8 | — | **I** | $0.03 | ✓ |
| black-forest-labs/flux.2-flex | 0.06/0.06 | in $0.06/MP, out $0.06/MP | megapixel | 0–8 | — | **I** | $0.05 | ✓ |
| black-forest-labs/flux.2-max | —/0.07 | $0.07/MP | megapixel | 0–8 | — | **I** | $0.07 | ✓ |
| sourceful/riverflow-v2.5-pro | —/0.13 | $0.13 (2K $0.15, 4K $0.17) | image | 0–10 | — | **I** | **$0.248** | ✓ list; ⚠️ measured 1.9× list |
| sourceful/riverflow-v2.5-fast | —/0.019 | $0.019 (2K $0.021) | image | 0–4 | — | **I** | **$0.029** | ✓ list; ⚠️ measured 1.5× list |
| sourceful/riverflow-v2-pro | —/0.15 | $0.15 (4K $0.33); **+$0.20 per input reference**, +$0.03 per font | image | 0–10 | — | **I** | $0.15 | ✓; hidden reference cost |
| sourceful/riverflow-v2-fast | —/0.02 | $0.02 (2K $0.04); **+$0.20 per input reference** | image | 0–4 | — | **I** | $0.02 | ✓; hidden reference cost |
| bytedance-seed/seedream-4.5 | —/0.04 | $0.04 | image | 0–14 | — | **I** | $0.04 @2048² | ✓ |
| recraft/recraft-v4.1-pro | —/0.21 | $0.21 | image | 0–1 | 3:2, 2:3 | **I** | $0.21 | ✓ |
| recraft/recraft-v4.1 | —/0.035 | $0.035 | image | 0–1 | 3:2, 2:3 | **I** | $0.035 | ✓ |
| recraft/recraft-v4.1-utility-pro | —/0.21 | $0.21 | image | 0–1 | 3:2, 2:3 | **I** | $0.21 | ✓ |
| recraft/recraft-v4.1-utility | —/0.035 | $0.035 | image | 0–1 | 3:2, 2:3 | **I** | $0.035 | ✓ |
| recraft/recraft-v4-pro | —/0.25 | $0.25 | image | 0–1 | 3:2, 2:3 | **I** | $0.25 | ✓ |
| recraft/recraft-v4 | —/0.04 | $0.04 | image | 0–1 | 3:2, 2:3 | **I** | $0.04 | ✓ |
| recraft/recraft-v3 | —/0.04 | $0.04 | image | 0–1 | 3:2, 2:3 | **I** | $0.04 | ✓ |
| x-ai/grok-imagine-image-quality | 0.01/0.05 | — | — | — | — | — | (historic $0.05) | 🔴 **DELISTED** |

**Tally (image):** 33 live, 1 delisted. 0 output-price drifts. 5 input-field issues: GPT Image ×3 missing input rates; MAI ×2 storing the text rate where the label says image tokens. 1 entry expiring. `MODEL_METADATA.releaseDate` matches the OpenRouter `created` date for all 33 live entries.

### 1b. How Pixel renders these prices today (label bugs)

`modelBrowserOptions.ts` picks units from **id prefixes**, not data:

| Rule | Consequence |
|---|---|
| `google/`, `openai/`, `microsoft/` → "$in/$out per 1M image tokens", plus estimate `outputCost × 1,290 tokens` | The Gemini input (0.5, 0.25…) is the **text-prompt** rate. MAI input (5) is the **text** rate. Both are labelled "image tokens". GPT Image shows "≈ $0.039/image" from a Gemini-2.5 token reference. Measured GPT Image 2 cost is $0.019 and GPT Image 1 is $0.167, so the estimate is off in both directions. Frame dropped this blanket 1,290 reference in sprint-06. |
| `black-forest-labs/` → "$/megapixel" | Correct for FLUX.2. **Wrong for FLUX.3 / FLUX.3 Klein**, which bill **per image by resolution tier**, if added under the current shape. |
| everything else → "$/image", `inputCost` ignored | Hides per-reference charges: Riverflow V2 $0.20/ref, Grok 2.0 $0.01/ref, Seedream 5 Pro / Qwen 3 $0.003/ref, Krea K3 $0.02/ref. Mislabels token-billed newcomers such as `tencent/hy-image-v3.5-preview` ($1.6/1M tokens) as per-image. |

This is the strongest argument for porting Frame's unit-aware `ImagePricing` (§4).

### 1c. Reconciliation with Frame sprint-06 (`ImageModels.ts`, 54 entries)

Frame added these since Pixel's July curation (and Pixel lacks them): **GPT Image 2.5 Sunburst/Flare, MAI-Image 2.6 / 2.6 Flash, Meta Muse Image (chat transport), Grok Imagine Image 2.0, Recraft V4 Styles / Styles Pro, Recraft V4.1 Flash, FLUX.3 Image, Seedream 5.0 Flash/Lite/Pro, Qwen Image 3 / 3 Pro, Ming Image 0.1 Design**, plus three Riverflow V2 preview tiers and the Gemini 2.5 preview alias. Pixel had removed the last four in 38bd8ac.

The following comes from re-verifying Frame's fields against today's per-endpoint records (`scripts/diff_frame.py`):

| Frame entry | Frame value | Live 2026-11-07 | Action for the shared catalog |
|---|---|---|---|
| x-ai/grok-imagine-image-quality | listed | 🔴 delisted (U2) | Remove (Frame too) |
| inclusionai/ming-image-0.1-design | listed (added after 10-02) | 🔴 Image API 404, 0 chat endpoints | Remove (Frame too) |
| google/gemini-2.5-flash-image-preview | listed (mirrors parent price) | Image API 404, 0 chat endpoints (Frame's fixture already showed 0) | Don't adopt in Pixel. Frame: consider removing. |
| sourceful/riverflow-v2-{max,standard,fast}-preview | listed with "preview reference" prices | Image API 404, 0 chat endpoints | Don't adopt in Pixel |
| qwen/qwen-image-3, qwen-image-3-pro | `referenceImages {0,4}` | **{0,3}** (both endpoints' `input_references.max`) | Fix → 3 |
| google/gemini-3-pro-image | `supportedResolutions ['1K','2K','4K']` | ai-studio/global: 1K/2K/4K; **vertex/global: 1K/2K** | Keep the union with a comment, or intersect to 1K/2K (owner's call; O4) |
| `supportsSeed` (convention: omitted ⇒ true) | omitted on 28 entries | Image API endpoint records list `seed` for **only 18 models**: FLUX.2 ×4, FLUX.3 Klein, Seedream ×4, Krea ×4, Qwen ×4, Tencent. Gemini, GPT, MAI, Riverflow, Recraft and Grok do not list it. | Record `supportsSeed: false` from data. The API reference calls endpoint records "each endpoint's definitive supported parameters". Chat routes (Gemini/GPT conversation) do list `seed`, and Frame's mode helper already hardcodes `supportsSeed: true` for chat. |
| openai/gpt-image-2 / -1 / -1-mini, gpt-5.x wrappers | no `input` | input-image $8 / $10 / $2.5 / $8 / $10 / $2.5 | Add `input` for parity with Frame's own GPT 2.5 entries (`input: 8`) |
| krea/krea-2-* comment | "endpoints API returns no pricing yet" | Now published, and matches ($0.06/$0.03/$0.015) | Update the comment |
| meta/muse-image | `supportedAspectRatios ['auto']`, transport chat | Image API endpoint list still empty. 1 chat endpoint (Meta). Page still says "$0.01/image". | ✓ unchanged |
| GPT-family `approxUsdPerImage` | "@ 1K · high" references (GPT Image 2 $0.211, 2.5 $0.053) | OpenRouter-measured t2i medians at 1024² (harness quality unpublished): GPT Image 2 **$0.0186**, 2.5 Flare/Sunburst **$0.0186/$0.0188**, 1 $0.167, 1 Mini $0.033 | Not changed unilaterally. See O5: the "high" basis may overstate GPT Image 2 by about 11× relative to what OpenRouter's own harness paid. |
| Gemini, MAI, Qwen, Seedream Flash/Lite, Recraft, FLUX.2, Krea estimates/prices | — | Measured medians within ±3% of Frame's numbers (e.g. MAI 2.6 measured $0.0392 vs Frame's $0.039; Gemini 3.1 Flash $0.0684 vs $0.0672) | ✓ Frame's research holds up |
| x-ai/grok-imagine-image-2.0 | output $0.04 "@ 1K" | Variants low_1k $0.04, medium_1k $0.06. Measured $0.06 at 1024². | Keep $0.04 (lowest tier, per convention). Note that the default quality appears to be medium. |
| bytedance-seed/seedream-5-0-pro | $0.045 "@ 1K" | Measured **$0.09 at 2048²**, which is the `high_resolution` variant | Keep $0.045. Note that the observed default output is 2K. |
| black-forest-labs/flux-3-image | $0.041 "@ 768 · list" | Unchanged list. Measured $0.024 at 1024² (consistent with the 50% promo Frame saw on 10-02). | ✓ |

### 1d. Live image models not in Pixel (28), newest first

API: `I` = images-only, `C` = chat + images. Measured figures are t2i medians at 1024² unless noted. Pass rates are t2i / edit.

| Created | id | Provider | Native price (lowest tier) | Refs | Ratios / resolutions | API | Measured | Pass | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| 2026-11-04 | openai/gpt-image-2.6-sunburst | OpenAI | in-img $8, in-text $5, out $30 /1M tok | 0–16 | 9 incl. 21:9, auto; quality up to `max`; gif output | I | $0.0438 (edit $0.061) | unscored yet | **Add.** Newest OpenAI precision tier. |
| 2026-11-04 | openai/gpt-image-2.6-flare | OpenAI | same | 0–16 | same | I | $0.0438 (edit **$0.183**) | unscored yet | **Add.** Speed tier. It is also OpenRouter's server-tool default image model. |
| 2026-10-29 | sourceful/riverflow-v2.6-pro | Sourceful | $0.13 (2K $0.15, 4K $0.17) | 0–10 | 11 incl. 5:4, 4:5, auto; 1K/2K/4K | I | $0.157 | 0.83 / **0.968** | **Add.** Best edit score in the set. |
| 2026-10-16 | qwen/qwen-image-2.1-turbo | Qwen | $0.0184 (1K = 2K) | 0–4 | 13; 1K/2K; seed | I | $0.0184 | 0.774 / 0.839 | **Add** (budget) |
| 2026-10-16 | qwen/qwen-image-2.1-pro | Qwen | $0.046 | 0–4 | same | I | $0.046 | 0.755 / 0.903 | Optional. Qwen Image 3 Pro is cheaper at 1K ($0.04) and scores higher on t2i. |
| 2026-10-15 | krea/k3-edit | Krea | out $0.03 (2K $0.06); **in $0.02/ref** (2K $0.07); +$0.02 "high thinking" surcharge | **1–8 required** | 7; 1K/2K; seed | I | edit $0.01 (below list; promo?) | edit 0.806 | **Add as edit-only.** Needs Frame's `referenceImages.min ≥ 1` gating. |
| 2026-10-15 | black-forest-labs/flux-3-image-klein | BFL | **per image**: 768 $0.008, 1K $0.009, 1.5K $0.011, 2K $0.014, 4K $0.036 | 0–10 | 16 incl. 7:5, 5:7; seed | I | $0.009 | 0.717 / 0.742 | **Add** (budget, open weights) |
| 2026-10-06 | google/gemini-nano-banana-2.1 | Google | out **$30/1M** img tok (half of NB2); text $1.5/$7.5 | 0–14 | 14; 1K/2K/4K | **C** | **$0.0361** | **0.887 / 0.903** | **Add ⭐; default candidate** (§3). Caveat: one provider endpoint (AI Studio) vs NB2's three. |
| 2026-10-05 | tencent/hy-image-v3.5-preview | Tencent | $1.6/1M output tok | 0–20 | 13; 1K–4K; seed | I | $0.024 @1536² (implies ~15k tok/img; derived) | 0.755 / 0.935 | Optional/skip. Preview; token count undocumented. |
| 2026-10-01 | bytedance-seed/seedream-5-0-flash | ByteDance | $0.018 | 0–14 | 18; 1K/2K; seed | I | $0.018 @2048² | 0.792 / 0.935 | **Add** (Frame has) |
| 2026-10-01 | black-forest-labs/flux-3-image | BFL | per image: 768 $0.041, 1K $0.048, 1.5K $0.07, 2K $0.10, 4K $0.607 | 0–10 | 16 | I | $0.024 (promo) | 0.792 / 0.903 | **Add** (Frame has) |
| 2026-09-23 | recraft/recraft-v4.1-flash | Recraft | $0.007 | **none** | 6 | I | $0.007 | 0.66 | **Add** (Frame has; no references) |
| 2026-09-09 | openai/gpt-image-2.5-sunburst | OpenAI | 8/5/30 | 0–16 | 9 | I | $0.0188 | 0.849 / 0.903 | **Add** (Frame has) |
| 2026-09-09 | openai/gpt-image-2.5-flare | OpenAI | 8/5/30 | 0–16 | 9 | I | $0.0186 | **0.925 / 0.935** | **Add** (Frame has). Top-2 overall at about 1/13 the cost of Riverflow 2.5 Pro. |
| 2026-09-04 | microsoft/mai-image-2.6 | Microsoft | in-text $5, in-img $8, out $38 | 0–5 | 8 | I | $0.0392 | 0.736 / 0.935 | **Add** (Frame has; supersedes 2.5 at a lower rate) |
| 2026-09-04 | microsoft/mai-image-2.6-flash | Microsoft | 1.75 / 2.5 / 19 | 0–5 | 8 | I | $0.0196 | 0.66 / 0.806 | **Add** (Frame has) |
| 2026-08-26 | meta/muse-image | Meta | $2.395/1M tok; OpenRouter page: ≈$0.01/image | none advertised | auto only | **chat only** (Image API has 0 endpoints) | $0.01 @1600² | 0.887 / 0.871 | **Add** (Frame has). The only non-Gemini/GPT chat-route image model. Pixel's client needs `meta/` → `['image']`. |
| 2026-08-26 | recraft/recraft-v4-styles-pro | Recraft | $0.10 + $0.005 style fee/request | **1–10 required** | 12 | I | edit $0.105 @2048² | edit 0.839 | **Add with min-ref gating** (Frame has) |
| 2026-08-26 | recraft/recraft-v4-styles | Recraft | $0.035 + $0.005/request | **1–10 required** | 12 | I | edit $0.04 | edit 0.71 | same |
| 2026-08-26 | recraft/recraft-v4-styles-pro-vector | Recraft | $0.12 + $0.005/request | **1–10 required** | 12 | I | — | — | → **SVG list** (§2a), not raster |
| 2026-08-26 | recraft/recraft-v4-styles-vector | Recraft | $0.05 + $0.005/request | **1–10 required** | 12 | I | — | — | → **SVG list** |
| 2026-08-13 | bytedance-seed/seedream-5-0-lite | ByteDance | $0.035 (2K/4K only) | 0–14 | 18; seed | I | $0.035 @2048² | 0.868 / 0.806 | **Add** (Frame has) |
| 2026-08-12 | bytedance-seed/seedream-5-0-pro | ByteDance | $0.045 (high-res $0.09); +$0.003/ref | 0–14 | 18; 1K/2K; seed | I | $0.09 @2048² | 0.792 / 0.839 | **Add** (Frame has) |
| 2026-08-11 | x-ai/grok-imagine-image-2.0 | xAI | $0.04 low-1K … $0.08 medium-2K; +$0.01/ref | 0–3 | 14; 1K/2K | I | $0.06 | 0.792 / 0.839 | **Add as the replacement for the delisted Quality model** |
| 2026-08-05 | qwen/qwen-image-3-pro | Qwen | $0.04 (2K $0.075); +$0.003/ref | **0–3** | 13; seed | I | $0.04 | **0.943** / 0.75 | **Add** (Frame has). Best t2i pass rate under $0.05. |
| 2026-08-05 | qwen/qwen-image-3 | Qwen | $0.03; +$0.003/ref | **0–3** | 13; seed | I | $0.03 | 0.755 / 0.688 | **Add** (Frame has) |
| 2026-05-13 | recraft/recraft-v4-pro-vector | Recraft | $0.30 | 0–1 | 6 | I | $0.30 @2048² SVG | — | Skip. Superseded by 4.1 Pro Vector at the same price. |
| 2026-05-13 | recraft/recraft-v4-vector | Recraft | $0.08 | 0–1 | 6 | I | $0.08 SVG | — | Skip. Superseded by 4.1 Vector at the same price. |

### 1e. Proposed image changes

- **Remove:** `x-ai/grok-imagine-image-quality` (delisted) and `openai/gpt-5-image-mini` (expires 2026-12-01; migrate to `openai/gpt-image-1-mini`, same $8/1M, or to NB2 Lite for a chat route).
- **Add (Pixel drop-in, 19):** NB 2.1 ⭐, GPT Image 2.6 Sunburst/Flare, GPT Image 2.5 Flare/Sunburst, MAI-Image 2.6 / 2.6 Flash, Meta Muse Image, Grok Imagine Image 2.0, Seedream 5.0 Pro/Lite/Flash, Qwen Image 3 Pro / 3 / 2.1 Turbo, Riverflow V2.6 Pro, FLUX.3 Image / Klein, Recraft V4.1 Flash. That gives 34 − 2 + 19 = **51** entries in Part A. Part B (shared with Frame) has **54**: Frame's 54 − 7 not-live/retiring + 7 new.
- **Add only with min-reference gating (unit-aware version only):** Krea K3 Edit, Recraft V4 Styles / Styles Pro.
- **Move ⭐:** GPT Image 2 → GPT Image 2.6 Sunburst is *not* recommended yet: it is unscored and its measured cost is 2.4× GPT Image 2 in the same harness. Keep ⭐ on GPT Image 2 or move it to **GPT Image 2.5 Flare**, the top scorer at $0.019 measured. Add ⭐ to **Nano Banana 2.1**.

The full arrays are in `proposed-catalog.ts`, Part A (current shape) and Part B (Frame sprint-06 shape, shareable).

**Verification of `proposed-catalog.ts`:** it type-checks under `tsc --strict` with both repos' TypeScript 5.9.3. `scripts/verify_proposed.js` cross-checked all 130 entries (Part A 51 + 12, Part B 54 + 13) against the snapshots. Every stored price equals a live endpoint value. Every Part B `referenceImages`, `supportedAspectRatios`, `supportedResolutions` and `supportsSeed` value matches the endpoint records. Every `PROPOSED_RELEASE_DATES` value equals OpenRouter `created`. There are no duplicate ids, and the migration targets are live. Result: **ALL CHECKS PASSED**.

---

## 2. SVG catalog (`OPENROUTER_SVG_MODELS`, 9 entries)

### 2a. Native vector (SVG-output) models

Exactly six live models advertise `output_format: ['svg']`, all from Recraft. No other provider ships native SVG output today, and no chat-feed model lists `svg` in its modalities. All six are **`/api/v1/images`-only** in the API-path list (U3).

| id | Status | Price | Refs | Aspect ratios (endpoint) | Notes |
|---|---|---|---|---|---|
| recraft/recraft-v4.1-pro-vector ⭐ (default) | ✓ in catalog | $0.30/SVG ✓ (measured $0.30, 2048² SVG) | 0–1 | 1:1, 4:3, 3:4, 16:9, 9:16, auto | Keep. |
| recraft/recraft-v4.1-vector | ✓ in catalog | $0.08 ✓ (measured $0.08, 1024²) | 0–1 | same | Keep. |
| recraft/recraft-v4-styles-pro-vector | **new 2026-08-26** | $0.12 + $0.005 style fee/request | **1–10 required** | 12, covering **all 7 Pixel ratios** | Add **only with UI gating**: Generate is disabled until a raster reference is attached. Pixel's SVG tab accepts *one* reference image, and an attached SVG goes in as text (`referenceSvgText`), not as an image. Frame's research gives these reference constraints for the raster Styles models: PNG/JPEG/WebP, ≥256 px shortest edge. They are assumed to apply to the vector variants; to verify. |
| recraft/recraft-v4-styles-vector | **new 2026-08-26** | $0.05 + $0.005/request | **1–10 required** | 12 | Same as above. Budget style-matched SVG. |
| recraft/recraft-v4-pro-vector | not in catalog | $0.30 | 0–1 | 6 | Skip (superseded, same price) |
| recraft/recraft-v4-vector | not in catalog | $0.08 | 0–1 | 6 | Skip (superseded, same price) |

**"1:1 only" label.** `CHANGELOG.md` (May 2026) says "Recraft ignores `aspect_ratio` for vector output". `OpenRouterImageSVGClient` sends **no** `image_config` at all. Today the Image API endpoint records **advertise** 5 ratios plus auto for the 4.1 vector models, and 12 for Styles vector. Under the `/images` transport, `aspect_ratio` is a first-class parameter. This needs a keyed retest (O3). If ratios are honored, drop "1:1 only" and send the ratio. Pixel's 3:2 and 2:3 are not supported by the 4.1 vector models.

**Routing constraint.** `SVGOrchestrator.selectClient`, the `SVGGenerationView` refine gate and `modelBrowserOptions` all key on `id.startsWith('recraft/')`. That still holds for all six vector models (all `recraft/`), but it is fragile. Prefer a catalog `kind: 'native-vector'` field (§4).

### 2b. Code-SVG text models: current entries

| id | Stored $/1M in/out | Live (standard endpoint) | Vision | Created | Reasoning (live) | Endpoints | Verdict |
|---|---|---|---|---|---|---|---|
| anthropic/claude-fable-5 | 10/50 | $10/$50 | ✓ | 2026-06-09 | mandatory, default high | 6 | ✓. Superseded by Fable 5.1 at the same price. |
| anthropic/claude-opus-5 | 5/25 | $5/$25 | ✓ | 2026-07-24 | optional, default high | 11 | ✓. Superseded by Opus 5.5 ($4/$20). |
| anthropic/claude-opus-5-fast | 10/50 | — | — | — | — | **0** | 🔴 **DELISTED (U1)** |
| openai/gpt-5.6-sol | 5/30 | **$4/$20** | ✓ | 2026-07-09 | optional, medium | 8 | ⚠️ drift (U6) |
| openai/gpt-5.6-sol-pro | 5/30 | **$4/$20** | ✓ | 2026-07-09 | optional, medium | 5 | ⚠️ drift (U6) |
| openai/gpt-5.4 | 2.5/15 | $2.5/$15 | ✓ | 2026-03-05 | optional (off), medium | 7 | ✓ (aging) |
| google/gemini-3.1-pro-preview | 2/12 | $2/$12 | ✓ (+audio/video) | 2026-02-19 | mandatory, medium | 6 | ✓. Superseded by Gemini 4 Argon ($2/$10). |

**Tally (SVG):** 6 verified (including 2 Recraft), 2 drifted, 1 delisted.

### 2c. New frontier text models since the 2026-07-27 curation

All models listed accept image input, which matters because the SVG tab sends a reference image as `image_url`. Prices are the standard first-party endpoint, $/1M tokens. Batch (`:batch`) SKUs are excluded; Pixel calls chat synchronously.

| Created | id | $/1M in/out | Context / max out | Reasoning default | Endpoints | Position (OpenRouter description) | Assessment for SVG code |
|---|---|---|---|---|---|---|---|
| 2026-10-26 | openai/gpt-6.1-terra | 1 / 5 | 1.05M / 128K | optional (on), medium | 7 | Mid-tier; "particularly strong at understanding screenshots" | **Add**: budget OpenAI with a strong vision claim |
| 2026-10-23 | moonshotai/kimi-k3.1-pro | 2 / 10 (Moonshot); 24 endpoints incl. fp4 at $0.33–$1.9 | 1M / 943K | optional, **default max** | 24 | Flagship open-weight; mentions 3D | Optional. Default `max` effort risks exhausting Pixel's 16K `max_tokens` (§5). Quantized routes add quality variance. |
| 2026-10-13 | google/gemini-4-argon | 2 / 10 | 1M / 943K | mandatory, medium | 6 | Google flagship reasoning | **Add.** Replaces Gemini 3.1 Pro Preview. Cheaper output, newer generation. |
| 2026-10-07 | anthropic/claude-haiku-5.5 | **0.10 / 0.50** | 1M / 128K | optional, medium | 10 | Small and fast; "stronger coding" | **Add.** Ultra-budget Claude draft lane: est. $0.002/SVG under Pixel's 1k+4k assumption. |
| 2026-10-06 | mistralai/mistral-large-4-0 | 0.7 / 2.1 | 1M / 262K | optional, high | 2 | Frontier multimodal | Optional |
| 2026-10-12 | meta/muse-wonder | 4 / 20 | 1M / 943K | mandatory, medium | 1 | Frontier reasoning | Skip (single endpoint, no coding claim) |
| 2026-09-29 | openai/gpt-6.1-sol | 2 / 10 | 1.05M / 128K | mandatory, medium | 9 | Upgrade to GPT-6 Sol; below Astra | **Add ⭐.** Analog of the owner's prior ⭐ GPT-5.6 Sol at half the price. |
| 2026-09-28 | anthropic/claude-sonnet-5.5 | 2 / 10 | 1M / 128K | mandatory, high | 10 | Sonnet upgrade; "building features" | **Add**: mid-price Claude |
| 2026-09-22 | anthropic/claude-opus-5.5 | **4 / 20** | 1M / 128K | mandatory, high | 11 | Anthropic flagship, succeeds Opus 5 | **Add ⭐.** Replaces Opus 5 (cheaper). |
| 2026-09-22 | openai/gpt-6-sol / gpt-6-luna | 2/10; 0.1/0.5 | 1.05M | optional | 9 / 8 | Superseded by 6.1 Sol / below Sol | Skip (6.1 Sol supersedes; Luna overlaps Haiku 5.5) |
| 2026-09-21 | x-ai/grok-4.7 | 2 / 6 | 500K / 450K | mandatory, high | 6 | xAI flagship ("SpaceXAI" in the feed) | **Add**: cheapest flagship output rate |
| 2026-09-21 | qwen/qwen3.8-omni-flash, xiaomi/mimo-v2.6-* | ≤0.44 / ≤0.87 | — | — | — | — | Skip (not frontier SVG candidates) |
| 2026-09-04 | openai/gpt-6-astra | 10 / 50 | 1.05M / 128K | mandatory, medium | 8 | OpenAI flagship | **Add** (premium) |
| 2026-09-03 | qwen/qwen3.8-max-0902 | 2 / 6 | 1M / 131K | mandatory, **default xhigh** | 2 | 2.4T MoE flagship | Optional (same max-token risk) |
| 2026-09-02 | google/gemini-3.8-flash | 0.75 / 3.75 (vertex/us 0.825/4.125) | 1M / 65K | mandatory, medium | 7 | "most intelligent Flash" | **Add**: budget Google |
| 2026-09-01 | anthropic/claude-fable-5.1 | 10 / 50 | 1M / 128K | mandatory, high | 4 | Fable 5 upgrade; "front-end and visual" gains | **Add ⭐.** Replaces Fable 5 at the same price. |
| 2026-09-10 | deepseek/deepseek-v4.1-flash | 0.051 / 0.567 (38 endpoints, fp4–bf16, up to $0.45/$1.8) | 1M | optional, high | 38 | First CED-architecture model | Skip (provider/quantization variance) |
| 2026-09-18 | z-ai/glm-5.3-flashx | 0.37 / 1.25 | 1M | mandatory, **max** | 1 | Speed variant | Skip. GLM 5.3 / 5.3 Prime are **text-only** and cannot take references. |

**No SVG-quality measurement exists in this audit.** OpenRouter's media benchmarks are raster-only. The ⭐ picks rest on four things: lab-flagship positioning, vision input, price against the predecessor, and endpoint redundancy. They mirror the owner's existing ⭐ slots: native vector, Fable, Opus, OpenAI high-end. A 5-prompt bake-off is recommended before release (O7).

### 2d. Proposed SVG list (13 entries; owner curates ~8–14)

1. ⭐ `recraft/recraft-v4.1-pro-vector`: native SVG, $0.30. Keep as default (pending U3/O3).
2. `recraft/recraft-v4.1-vector`: native SVG budget, $0.08.
3. `recraft/recraft-v4-styles-pro-vector`: native SVG matched to the style of a reference, $0.12 + $0.005. **Requires a reference image.** Unit-aware version only; it is commented out in the drop-in because Pixel has no gating.
4. ⭐ `anthropic/claude-opus-5.5`: $4/$20 (est. $0.084/SVG under the 1k-in + 4k-out house assumption)
5. ⭐ `anthropic/claude-fable-5.1`: $10/$50 (est. $0.21/SVG)
6. `anthropic/claude-sonnet-5.5`: $2/$10 (est. $0.042)
7. `anthropic/claude-haiku-5.5`: $0.10/$0.50 (est. $0.0021)
8. ⭐ `openai/gpt-6.1-sol`: $2/$10 (est. $0.042)
9. `openai/gpt-6-astra`: $10/$50 (est. $0.21)
10. `openai/gpt-6.1-terra`: $1/$5 (est. $0.021)
11. `google/gemini-4-argon`: $2/$10 (est. $0.042). The strongest non-⭐; promote if it wins the bake-off.
12. `google/gemini-3.8-flash`: $0.75/$3.75 (est. $0.0158)
13. `x-ai/grok-4.7`: $2/$6 (est. $0.026)

**Remove:** `claude-opus-5-fast` (delisted), `claude-fable-5` (→ 5.1), `claude-opus-5` (→ 5.5), `gpt-5.6-sol` and `gpt-5.6-sol-pro` (→ 6.1 Sol), `gpt-5.4` (→ 6.1 Terra: cheaper and newer), `gemini-3.1-pro-preview` (→ Gemini 4 Argon). The owner's 38bd8ac precedent is to replace superseded generations rather than accumulate them. Saved settings pointing at removed-but-live ids keep working, because any id is still sent. Only the delisted ids need migration.

**Optional extras:** `moonshotai/kimi-k3.1-pro`, `qwen/qwen3.8-max-0902`, `mistralai/mistral-large-4-0`, `recraft/recraft-v4-styles-vector`. A "legacy" `anthropic/claude-opus-5` is also an option for projects tuned to it.

---

## 3. Defaults

| Setting | Declared in | Value | Live? | Assessment |
|---|---|---|---|---|
| `pixelMinion.imageModel` | package.json, `SettingsHandler.ts:161`, `DEFAULT_IMAGE_MODEL` | `google/gemini-3.1-flash-image` | ✓ (3 image endpoints, 3 chat endpoints, chat-route capable) | **Not broken.** Candidate switch to `google/gemini-nano-banana-2.1`: half the output token rate, measured $0.036 vs $0.068, higher pass rates (0.887/0.903 vs 0.811/0.839), chat-route capable, OpenRouter describes it as succeeding NB2 and NB Pro. Risk: a single endpoint, and only 1 month old. Switch after the smoke test. |
| `pixelMinion.svgModel` | package.json, `SettingsHandler.ts:162`, `DEFAULT_SVG_MODEL`, `useSettings.ts:74`, `OpenRouterImageSVGClient` default | `recraft/recraft-v4.1-pro-vector` | ✓ listed, $0.30 ✓ | **At risk via U3.** Its API-path list is `/api/v1/images` only, and Pixel calls chat/completions. Verify first. |
| `pixelMinion.openRouterModel` | package.json, `SettingsHandler.ts:160`, `useSettings.ts:68`, both text clients' defaults, `TextHandler.ts:149` | `openai/gpt-5.1` | ✓ $1.25/$10 | Not broken. Optional upgrade to `openai/gpt-6.1-terra` ($1/$5: cheaper and newer). |
| Enhance prompt model | `EnhanceHandler.ts:45` (hardcoded) | `openai/gpt-5.1` | ✓ | Optional: `openai/gpt-6.1-terra` or `anthropic/claude-haiku-5.5` ($0.10/$0.50). |
| `package.json` `svgModel` description | — | "recommended: Claude Opus 4.7 for quality…" | — | **Stale text.** Opus 4.7 has not been in the catalog since 38bd8ac. |

**Migration map** (recommended in `SettingsHandler` and the `useSVGGeneration`/`useImageGeneration` restore path), for saved settings and persisted webview state that reference delisted ids:
`anthropic/claude-opus-5-fast → anthropic/claude-opus-5.5`, `x-ai/grok-imagine-image-quality → x-ai/grok-imagine-image-2.0`, and from 2026-12-01 `openai/gpt-5-image-mini → openai/gpt-image-1-mini`.

---

## 4. Pricing and capability representation: recommendation

**Recommendation: share Frame's sprint-06 `ImageModelDefinition` verbatim for raster models. Give Pixel a discriminated `SvgModelDefinition` that reuses it for native-vector models and adds a per-1M-token `TextPricing` for code models.** Pixel's single `ModelDefinition {inputCost, outputCost}` documents itself as "$ per 1M tokens". Today it holds per-image, per-megapixel and per-1M-token numbers in the same two fields. The renderer guesses which unit applies from id prefixes. That guess already mislabels Gemini and MAI inputs and GPT estimates (§1b), and it would mislabel FLUX.3 and Tencent.

### 4.1 Type sketch

These are the types used in `proposed-catalog.ts` Part B:

```ts
// ── shared with Frame (verbatim from sprint-06 providers.ts) ──
export type ImagePricingUnit = 'image' | 'megapixel' | 'image-token';
export interface ImagePricing {
  unit: ImagePricingUnit;
  output: number;            // native unit, lowest tier
  input?: number;            // INPUT-IMAGE rate in the same unit family (per ref image | per input MP | per 1M input-image tokens)
  approxUsdPerImage?: number; approxNote?: string; approxBasis?: string; // display-only, sourced
}
export interface ImageModelDefinition {
  id: string; displayName: string; description?: string;
  transport?: 'images' | 'chat-completions';          // omitted ⇒ images
  supportsSeed?: boolean;                             // false when the /images endpoint record lacks `seed`
  referenceImages?: { min: number; max: number };     // min ≥ 1 ⇒ reference REQUIRED
  referenceMimeTypes?: readonly ('image/png' | 'image/jpeg' | 'image/webp')[];
  imagePricing?: ImagePricing;
  supportedResolutions?: readonly ('512' | '768' | '1K' | '1.5K' | '2K' | '4K')[];
  supportedAspectRatios?: readonly AspectRatio[];     // Frame's wide AspectRatio union
}

// ── Pixel-only ──
export interface TextPricing { inputPer1M: number; outputPer1M: number } // standard endpoint, USD
export type SvgModelDefinition =
  | (ImageModelDefinition & { kind: 'native-vector' })            // transport 'images', output_format 'svg'
  | { kind: 'code'; id: string; displayName: string; description?: string;
      textPricing: TextPricing; acceptsImageInput: boolean;
      reasoning?: { mandatory: boolean; defaultEffort: string } };  // recorded from the live chat feed
```

Two optional `ImagePricing` extensions are worth proposing to Frame as well. Frame currently folds both into `approxBasis` text, which is fine for V1.
- `perRequest?: number`: flat request fees. Recraft Styles charges $0.005 per style; Krea K3 charges a $0.02 high-thinking surcharge.
- `tiers?: Record<string, number>`: display-only output price by resolution or quality variant (FLUX.3 768→4K, Grok 2.0 low/medium × 1K/2K, Seedream 5 Pro high-res).

### 4.2 Renderer

`modelBrowserOptions.ts` should switch on `imagePricing.unit` (port Frame's `imagePricingLabel` and `approxSuffix`). For `kind: 'code'` it should render `$in/$out per 1M tokens`. Two more changes:
- Badge and route the native-vector path from `kind`, not `id.startsWith('recraft/')`. That covers `SVGOrchestrator.selectClient` and the `SVGGenerationView` refine gate too.
- Keep the 1k-in + 4k-out SVG house assumption, but say that **reasoning tokens bill as output**. Opus 5.5, Fable 5.1, Sol and Argon reason by default, so the estimate is a floor.

### 4.3 Transport (needed to adopt Frame's image generator)

Port Frame's `OpenRouterImageTransport.ts` and `ImageGenerationModes.ts`. In that design, Single Shot goes to `POST /api/v1/images` with `aspect_ratio`, `resolution` and `input_references`. Conversation goes to chat/completions, and only for the Gemini set, the three GPT-5 image wrappers and Muse.

Pixel-specific additions:
- **SVG output:** Frame's transport `detectRasterMime()` rejects non-raster. Pixel's native-vector path needs `output_format: 'svg'` and acceptance of `media_type: 'image/svg+xml'` (`b64_json` → decode).
- **Refine gating:** this follows naturally. Native-vector models have no chat route, which is consistent with Pixel's existing "Refine not supported for Recraft" UX.
- **Aspect ratio type:** Pixel's `AspectRatio` (7 values) must widen to Frame's union, or the shared catalog must import Frame's type.

---

## 5. Other code-level findings

- **`max_tokens` and reasoning.** `OpenRouterDynamicTextClient` sends `max_tokens: 16384`. `CLAUDE.md` claims 48,000, a doc/code drift. Every recommended code model reasons by default: Opus 5.5 and Fable 5.1 at `high`, Kimi K3.1 Pro at `max`, Qwen3.8 Max at `xhigh`. On OpenRouter, reasoning tokens count against `max_tokens`, so a long SVG can truncate (`finish_reason: length`). The current Fable 5 is also mandatory-high, so this is not new. Consider sending `reasoning: { effort: 'medium' }` for SVG, or raising `max_tokens` to 32–48K.
- **`temperature: 0.7` is sent, but none of the Anthropic or OpenAI frontier models list `temperature`** in `supported_parameters`. That includes the *current* Opus 5, Fable 5 and Sol entries. The owner's current setup evidently works, so OpenRouter is silently dropping it. Harmless, but worth not relying on.
- **Model-browser metadata.** `providerNames` lacks `qwen`, `tencent`, `meta`, `moonshotai` and `mistralai`. `MODEL_METADATA` needs `releaseDate` (OpenRouter `created`) and a narrative for each add; `proposed-catalog.ts` includes `PROPOSED_RELEASE_DATES`. OpenRouter now labels xAI *text* models "SpaceXAI: …". Image models still say "xAI: …".

---

## 6. Open questions

| # | Question | Why it matters | How to resolve |
|---|---|---|---|
| O1 | Do `/api/v1/images`-only models (all Recraft incl. the SVG default, FLUX, Krea, Riverflow, Seedream, Qwen, MAI, `gpt-image-*`) still work through `/chat/completions` with `modalities: ['image']`? | U3: the default and ~28 entries | Keyed smoke test, 3 cheap calls (~$0.12 total) |
| O2 | Does `['image','text']` get rejected for Krea, MAI and Recraft V4.1? | U4 | Same smoke test |
| O3 | Do Recraft vector models now honor `aspect_ratio` (via `/images` or chat `image_config`)? | Drop the "1:1 only" limitation | One $0.08 call at 16:9 with `recraft-v4.1-vector` |
| O4 | Gemini 3 Pro Image `supportedResolutions`: union (1K/2K/4K) or intersection (1K/2K)? | The vertex/global endpoint lacks 4K | Owner policy. Frame uses the union. |
| O5 | Should GPT-family per-image estimates be re-based from "high quality" references to OpenRouter's measured benchmark medians? Measured GPT Image 2 is $0.019 vs a $0.211 badge. | Pixel and Frame send no `quality`, so the provider default (`auto`) applies. Under the current basis GPT Image 2 looks 4.8× pricier than GPT Image 2.6. Measured in the same harness, it is 2.4× *cheaper*. | Decide the shared estimate basis. Until then, GPT Image 2.6 carries `approxNote` only (no invented number). |
| O6 | Why do Riverflow V2.5 Pro / V2.5 Fast / V2.6 Pro measure 1.9× / 1.5× / 1.2× list price at 1024² with no references? | Users may pay much more than the badge | Inspect `usage.cost` on one keyed call. The likely cause is an un-itemized reasoning or planning charge ("integrated reasoning model plans"). |
| O7 | SVG code quality ranking among Opus 5.5, Fable 5.1, GPT-6.1 Sol, Gemini 4 Argon and Grok 4.7 | ⭐ picks rest on positioning, not measurement | 5-prompt bake-off, with and without a reference image |
| O8 | What does chat-endpoint `status: -5` mean (gpt-5.4-image-2, gpt-5-image-mini)? | Possible degradation or retirement signal | Watch. Frame's 09-10 fixture had 0. |
| O9 | Do Recraft Styles *vector* models share the raster Styles reference constraints (PNG/JPEG/WebP, ≥256 px)? | Required for the UI gate | Recraft docs or one keyed call |
| O10 | Nano Banana 2.1 and GPT Image 2.6 vendor-documented token counts | Estimates are measured, not documented | Google/OpenAI pricing pages. Both hosts were blocked from this session. |

---

## Refresh procedure (next audit)

1. `GET /api/v1/images/models` + every `…/images/models/<id>/endpoints` → `scripts/live_capabilities.py` (intersection policy) → diff against the catalog with `scripts/diff_frame.py`.
2. `GET /api/v1/models?output_modalities=image` → read the **API paths** for the transport. Never read native prices from its normalized `pricing`.
3. `GET /api/v1/models` → SVG text candidates (vision input, `reasoning`, `expiration_date`). Then `…/models/<id>/endpoints` for standard-endpoint prices and delisting (0 endpoints).
4. `https://openrouter.ai/benchmarks/media/images/*` → `scripts/bench_costs.py` for measured cost and pass-rate sanity checks.
5. Merge, never clobber. Delisted ids get a settings migration, not a silent removal.

---

## Addendum — keyed smoke test and chat-route probe (2026-11-07, same day)

The owner approved a keyed test (≤ $0.50). **Total spend: $0.111.** This settles O1/O2 and refines U3/U4.

**Paid calls** (Pixel's exact request shapes):

| Model | Route | Result | Cost |
| --- | --- | --- | --- |
| `recraft/recraft-v4.1-vector` (default SVG) | `/chat/completions`, `modalities: ['image']` | ✅ 200, `data:image/svg+xml` | $0.08 |
| `black-forest-labs/flux.2-klein-4b` | `/chat/completions`, `['image']` + `image_config` | ✅ 200, PNG | $0.017 |
| `openai/gpt-image-1-mini` | `/chat/completions`, `['image']` | ❌ 404 "is an image generation model and cannot be used with the chat/completions endpoint. Use the /api/v1/images endpoint instead." | $0 |
| `krea/krea-2-medium-turbo` | `/chat/completions`, `['image','text']` | ❌ same 404 | $0 |
| `krea/krea-2-medium-turbo` | `/chat/completions`, `['image']` | ❌ same 404 (the modality fix alone does not help) | $0 |
| `black-forest-labs/flux.2-klein-4b` | `POST /api/v1/images` | ✅ 200, `data[].b64_json` JPEG | $0.014 |

**Free route probe.** OpenRouter checks chat routability *before* output modalities. A chat request asking for `modalities: ['audio']` therefore returns one of two errors without generating anything:
- "…cannot be used with the chat/completions endpoint" means the model is Image-API-only;
- "No endpoints found that support the requested output modalities: audio" means it is chat-routable.

Results for every current and proposed id:

- **Chat-blocked (Image API only):** `openai/gpt-image-2`, `gpt-image-1`, `gpt-image-1-mini`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, `gpt-image-2.6-flare`, `gpt-image-2.6-sunburst`; `krea/krea-2-large`, `krea-2-medium`, `krea-2-medium-turbo`, `k3-edit`; `black-forest-labs/flux-3-image`, `flux-3-image-klein`; `qwen/qwen-image-3`, `qwen-image-3-pro`, `qwen-image-2.1-turbo`; `meta/muse-image`. Frame routes Muse over chat; flagged upstream.
- **Chat-routable:** every other current catalog id. That covers Gemini, the GPT-5 image wrappers, FLUX.2, Riverflow, Seedream 4.5, MAI 2.5, Recraft (raster and vector) and all SVG code models. It also covers these proposed adds: Nano Banana 2.1, Seedream 5.0 Pro/Lite/Flash, MAI-Image 2.6/Flash, Recraft V4.1 Flash, Recraft V4 Styles (+ Pro, Pro Vector), Riverflow V2.6 Pro, Grok Imagine Image 2.0, and every proposed code model.
- **Delisted since v1.3.0** ("no provider serves this model anymore"): `sourceful/riverflow-v2-{max,standard,fast}-preview`, `x-ai/grok-imagine-image-quality`, `anthropic/claude-opus-4`.

**Consequences:**
- The released v1.3.0 catalog is not broken by the transport change. Its five delisted ids are now migrated on read.
- The six chat-blocked models that the PR #12 refresh added were removed in PR A (`RETIRED_MODELS`, reason `images-api-only`). They return with the P3 transport.
- PR B may add only chat-routable models.
