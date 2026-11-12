/**
 * High contrast keyboard focus on the Image tab's mode control (review
 * P4-m2, WCAG 2.4.7). jsdom applies no stylesheet, so this reads the rules.
 * The bug was cascade order: the HC rule marking the pressed half used
 * `outline` and outranked the focus rule, so focus on it was invisible. In
 * HC themes contrastActiveBorder and focusBorder are often one colour, so
 * the two marks must also differ in shape. The focus ring itself is the
 * component sheet's `::after` (an outline would be clipped by the pill, or
 * lose to global.css's button rule, as a first attempt did in dark themes).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const styles = join(__dirname, '../../../../presentation/webview/styles');
const css = readFileSync(join(styles, 'design-tokens.css'), 'utf8');
const componentCss = readFileSync(join(styles, 'components/image-generation-view.css'), 'utf8');

/** The declarations of the HC rule whose selector list contains `selector`, and where it starts. */
function hcRule(selector: string): { index: number; body: string } {
  const pattern = new RegExp(`body\\.vscode-high-contrast \\.app-container ${selector.replace(/[[\]"().:]/g, '\\$&')}[^{]*\\{([^}]*)\\}`);
  const match = pattern.exec(css);
  if (!match) throw new Error(`no high contrast rule for ${selector}`);
  return { index: match.index, body: match[1] };
}

it('marks the pressed half without an outline, so the focus outline is never overridden', () => {
  const pressed = hcRule('.image-mode-selector button[aria-pressed="true"]');
  expect(pressed.body).toMatch(/box-shadow:[^;]*contrastActiveBorder/);
  expect(pressed.body).not.toMatch(/outline/);
});

it('draws keyboard focus as a dashed ring in both HC themes, distinct from the solid pressed ring', () => {
  const focus = hcRule('.image-mode-selector button:focus-visible::after');
  expect(focus.body).toMatch(/border:\s*2px dashed var\(--vscode-focusBorder/);
  expect(css).toMatch(/body\.vscode-high-contrast-light \.app-container \.image-mode-selector button:focus-visible::after/);
});

it('draws the focus ring inside the pill, replacing the global outside outline that the pill would clip', () => {
  // `.app-container :is(button, …):focus-visible` is (0,3,0); this must beat it.
  expect(componentCss).toMatch(/\.app-container \.image-mode-selector button:focus-visible \{\s*outline: none;/);
  expect(componentCss).toMatch(/\.image-mode-selector button:focus-visible::after \{[^}]*content: '';[^}]*border: 2px solid var\(--px-focus-ring\)/);
});
