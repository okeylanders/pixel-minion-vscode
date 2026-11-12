# v1.4.0 dependency audit — 2026-11-12

The public npm registry reports **44 affected packages: 1 critical, 24 high, 9 moderate and 10 low**. `npm audit --omit=dev` reports **0**. `npm audit --audit-level=high` fails on the development dependency tree; this is not a clean full-audit claim. The configured private registry returned HTTP 404 for audit, so the checks used `--registry=https://registry.npmjs.org` without changing npm configuration.

## Applicability and release disposition

All affected packages are development dependencies. The production webpack source maps contain `marked` in the host and `react`, `react-dom`, `scheduler`, `css-loader` runtime and `style-loader` runtime in the webview; none overlaps the audit findings. `node_modules/**` is excluded from the VSIX. This supports no known affected dependency in the shipped bundles; it does not make the development environment vulnerability-free.

**Action: defer the development-tool dependency refresh to a separate maintenance change.** Dependency versions and resolutions are unchanged for this release. Review upgrades before running tools against untrusted source, templates, markup or remote responses; some findings concern packaging-network dependencies, so no claim is made that all development paths are unreachable.

The critical package is `handlebars@4.7.8`, reached through `ts-jest`. Inspection finds its use in `ts-jest/dist/cli/config/init.js`, compiling the tool’s fixed `JEST_CONFIG_TEMPLATE`. This release does not run that config generator or compile user templates. The code-injection preconditions are absent from the release workflow; it is not an applicable shipped-runtime critical. The [upstream advisory](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-3mfm-83xf-c92r) describes one affected AST/template path.

## Coverage and limits

Tests and production builds exercise trusted repository fixtures and configuration. They do not reproduce the dependency advisories. The passing application suite covers provider response parsing, image/SVG safety, persistence and UI behavior; that is not exploit coverage for build tools. Packaging exercises vsce with reviewed local README/manifest inputs.

For each moderate-or-higher package below, the listed top-level dependencies identify the affected development usage. Every row is excluded from the shipped dependency set and deferred as above. “Inherited” denotes an npm meta-vulnerability through another dependency. Advisory links are selected from npm’s response; packages may have additional advisories.

| Package | Severity | Locked version(s) | Development path | Advisory | Action |
| --- | --- | --- | --- | --- | --- |
| `@azure/identity` | moderate | 4.13.0 | `@vscode/vsce` | Inherited: @azure/msal-node | Defer tooling refresh |
| `@azure/msal-node` | moderate | 3.8.3 | `@vscode/vsce` | Inherited: uuid | Defer tooling refresh |
| `@typescript-eslint/eslint-plugin` | high | 6.21.0 | `@typescript-eslint/eslint-plugin` | Inherited: @typescript-eslint/type-utils, @typescript-eslint/utils | Defer tooling refresh |
| `@typescript-eslint/parser` | high | 6.21.0 | `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` | Inherited: @typescript-eslint/typescript-estree | Defer tooling refresh |
| `@typescript-eslint/type-utils` | high | 6.21.0 | `@typescript-eslint/eslint-plugin` | Inherited: @typescript-eslint/typescript-estree, @typescript-eslint/utils | Defer tooling refresh |
| `@typescript-eslint/typescript-estree` | high | 6.21.0 | `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` | Inherited: minimatch | Defer tooling refresh |
| `@typescript-eslint/utils` | high | 6.21.0 | `@typescript-eslint/eslint-plugin` | Inherited: @typescript-eslint/typescript-estree | Defer tooling refresh |
| `@vscode/vsce` | moderate | 2.32.0 | `@vscode/vsce` | Inherited: markdown-it | Defer tooling refresh |
| `ajv` | moderate | 6.12.6, 8.17.1 | `eslint`, `webpack` | [Advisory](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | Defer tooling refresh |
| `baseline-browser-mapping` | moderate | 2.8.32 | `autoprefixer` | [Advisory](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) | Defer tooling refresh |
| `brace-expansion` | high | 1.1.12, 2.0.2 | `@typescript-eslint/parser`, `@vscode/vsce`, `eslint`, `ts-jest` | [Advisory](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | Defer tooling refresh |
| `browserslist` | high | 4.28.0 | `autoprefixer`, `ts-jest`, `webpack` | [Advisory](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | Defer tooling refresh |
| `fast-uri` | high | 3.1.0 | `webpack` | [Advisory](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) | Defer tooling refresh |
| `flatted` | high | 3.3.3 | `eslint` | [Advisory](https://github.com/advisories/GHSA-25h7-pfq9-p65f) | Defer tooling refresh |
| `form-data` | high | 4.0.5 | `@vscode/vsce`, `jest-environment-jsdom` | [Advisory](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) | Defer tooling refresh |
| `handlebars` | critical | 4.7.8 | `ts-jest` | [Advisory](https://github.com/advisories/GHSA-2w6w-674q-4c4q) | Defer tooling refresh |
| `js-yaml` | high | 3.14.2, 4.1.1 | `eslint`, `postcss-loader`, `ts-jest` | [Advisory](https://github.com/advisories/GHSA-52cp-r559-cp3m) | Defer tooling refresh |
| `jws` | high | 3.2.2 | `@vscode/vsce` | [Advisory](https://github.com/advisories/GHSA-869p-cjfg-cm3x) | Defer tooling refresh |
| `linkify-it` | high | 3.0.3 | `@vscode/vsce` | [Advisory](https://github.com/advisories/GHSA-22p9-wv53-3rq4) | Defer tooling refresh |
| `markdown-it` | high | 12.3.2 | `@vscode/vsce` | [Advisory](https://github.com/advisories/GHSA-r7fv-28h4-cvq7) | Defer tooling refresh |
| `minimatch` | high | 3.1.2, 9.0.3 | `@typescript-eslint/parser`, `@vscode/vsce`, `eslint`, `ts-jest` | [Advisory](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | Defer tooling refresh |
| `nanoid` | high | 3.3.11 | `postcss` | [Advisory](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | Defer tooling refresh |
| `picomatch` | high | 2.3.1, 4.0.3 | `jest-environment-jsdom`, `tailwindcss` | [Advisory](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | Defer tooling refresh |
| `postcss` | high | 8.5.6 | `autoprefixer`, `css-loader`, `postcss`, `postcss-loader`, `tailwindcss` | [Advisory](https://github.com/advisories/GHSA-6g55-p6wh-862q) | Defer tooling refresh |
| `postcss-selector-parser` | moderate | 6.1.2, 7.1.1 | `css-loader`, `tailwindcss` | [Advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | Defer tooling refresh |
| `qs` | moderate | 6.14.0 | `@vscode/vsce` | [Advisory](https://github.com/advisories/GHSA-6rw7-vpxm-498p) | Defer tooling refresh |
| `serialize-javascript` | high | 6.0.2 | `webpack` | [Advisory](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) | Defer tooling refresh |
| `source-map-js` | high | 1.2.1 | `postcss` | [Advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | Defer tooling refresh |
| `terser-webpack-plugin` | moderate | 5.3.14 | `webpack` | Inherited: serialize-javascript | Defer tooling refresh |
| `tmp` | high | 0.2.5 | `@vscode/vsce` | [Advisory](https://github.com/advisories/GHSA-ph9p-34f9-6g65) | Defer tooling refresh |
| `underscore` | high | 1.13.7 | `@vscode/vsce` | [Advisory](https://github.com/advisories/GHSA-qpx9-hpmf-5gmw) | Defer tooling refresh |
| `undici` | high | 7.16.0 | `@vscode/vsce` | [Advisory](https://github.com/advisories/GHSA-f269-vfmq-vjvj) | Defer tooling refresh |
| `uuid` | moderate | 8.3.2 | `@vscode/vsce` | [Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Defer tooling refresh |
| `ws` | high | 8.18.3 | `jest-environment-jsdom` | [Advisory](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | Defer tooling refresh |

Low-severity findings are also confined to development dependencies and included in the total above. Raw audit output was retained locally in `/tmp/pixel-release-audit.json`; production output in `/tmp/pixel-release-audit-production.json`. Re-run the commands to refresh this time-sensitive assessment.
