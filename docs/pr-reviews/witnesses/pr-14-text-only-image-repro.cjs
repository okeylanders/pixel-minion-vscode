// Review witness for PR #14 at fa85d0c. No provider requests or real credentials.
// Run from the repository root: node docs/pr-reviews/witnesses/pr-14-text-only-image-repro.cjs
// It asserts the observed defect, not the desired behavior. Replace with a regression when fixed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request.startsWith('@shared/')) request = path.join(root, 'src/shared', request.slice(8));
  if (request === '@messages') request = path.join(root, 'src/shared/types/messages');
  if (request.startsWith('@utils/')) request = path.join(root, 'src/presentation/webview/utils', request.slice(7));
  return originalResolve.call(this, request, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (module, filename) => module._compile(ts.transpileModule(
    fs.readFileSync(filename, 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React, esModuleInterop: true } }
  ).outputText, filename);
}
require.extensions['.css'] = () => {};
const { OPENROUTER_IMAGE_MODELS } = require(path.join(root, 'src/shared/models'));
const { ImageOrchestrator } = require(path.join(root, 'src/infrastructure/ai/orchestration/ImageOrchestrator'));
const { OpenRouterImageClient } = require(path.join(root, 'src/infrastructure/ai/clients/OpenRouterImageClient'));
const model = OPENROUTER_IMAGE_MODELS.find(row => row.id === 'recraft/recraft-v4.1-flash');
assert.ok(model);
assert.equal(model.referenceImages.max, 0);
const image = 'data:image/png;base64,d2l0bmVzcw==';
const logger = { debug() {}, info() {}, warn() {}, error() {} };
const requests = [];
global.fetch = async (url, options) => {
  requests.push({ url, body: JSON.parse(options.body) });
  return { ok: true, json: async () => ({ choices: [{ message: {
    role: 'assistant', images: [{ image_url: { url: image } }]
  } }] }) };
};
const imageParts = request => request.body.messages.flatMap(message =>
  Array.isArray(message.content) ? message.content.filter(part => part.type === 'image_url') : []);
(async () => {
  const orchestrator = new ImageOrchestrator(logger);
  orchestrator.setClient(new OpenRouterImageClient({ getApiKey: async () => 'mock-only-key', hasApiKey: async () => true }, logger));
  const first = await orchestrator.generateImage('A blue square', { model: model.id, aspectRatio: '1:1' });
  assert.equal(imageParts(requests[0]).length, 0);
  await orchestrator.continueConversation(first.conversationId, 'Make it red');
  assert.equal(imageParts(requests[1]).length, 1);
  assert.equal(imageParts(requests[1])[0].image_url.url, image);
  assert.equal(requests[1].body.model, model.id);
  console.log('CONFIRMED: text-only Recraft V4.1 Flash continuation sends the previous output as image_url.');
  await orchestrator.generateImage('Use this reference', {
    model: model.id, aspectRatio: '1:1', referenceImages: [image]
  });
  assert.equal(imageParts(requests[2]).length, 1);
  console.log('CONFIRMED: initial generation also forwards an attached image despite referenceImages.max = 0.');

  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  global.MutationObserver = dom.window.MutationObserver;
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const { render, screen, cleanup } = require('@testing-library/react');
  const { ImageGenerationView } = require(path.join(root, 'src/presentation/webview/components/views/ImageGenerationView'));
  const noop = () => {};
  const state = {
    prompt: 'A blue square', model: model.id, aspectRatio: '1:1', seedInput: '', referenceImages: [image],
    conversationHistory: [], isLoading: false, isEnhancing: false,
    setPrompt: noop, setModel: noop, setAspectRatio: noop, setSeedInput: noop,
    addReferenceImage: noop, removeReferenceImage: noop, clearReferenceImages: noop,
    generate: noop, continueChat: noop, clearConversation: noop, saveImage: noop, enhancePrompt: noop,
  };
  render(React.createElement(ImageGenerationView, { imageGeneration: state }));
  assert.equal(screen.getByRole('button', { name: /Generate$/ }).disabled, false);
  cleanup();
  render(React.createElement(ImageGenerationView, { imageGeneration: {
    ...state, conversationId: 'witness', referenceImages: [],
    conversationHistory: [{ id: 'turn-1', prompt: 'A blue square', timestamp: 1, images: [] }]
  } }));
  assert.equal(screen.getByPlaceholderText('Refine: Make it more vibrant...').disabled, false);
  console.log('CONFIRMED: actual Image tab enables Generate with the attachment and exposes an enabled Refine input.');
  cleanup();
  dom.window.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
