/**
 * Model Browser option types (Frame sprint-06 shape).
 *
 * Frame declares these in ModelBrowserModal.tsx. Pixel keeps them in a `.ts`
 * module because the host typecheck (tsconfig.json, no JSX) compiles the
 * webview's `.ts` tests, and `modelBrowserOptions.ts` must not pull a `.tsx`
 * file into that program. ModelBrowserModal re-exports them, so imports can
 * follow Frame's paths.
 */

export type ModelBrowserBadgeTone = 'default' | 'accent' | 'warn';

export interface ModelBrowserBadge {
  label: string;
  tone?: ModelBrowserBadgeTone;
}

export interface ModelBrowserOption {
  id: string;
  label: string;
  description?: string;
  narrative?: string;
  provider?: string;
  family?: string;
  releaseDate?: string;
  badges?: ModelBrowserBadge[];
  costLabel?: string;
  costDescription?: string;
  metaLabel?: string;
  searchText?: string;
}
