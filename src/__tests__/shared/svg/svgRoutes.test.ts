import { isNativeVectorSvgModel, svgModelSupportsRefinement } from '../../../shared/svg/svgRoutes';
import { OPENROUTER_SVG_MODELS } from '../../../shared/models';

describe('svgRoutes', () => {
  it('routes every curated model by its catalog kind', () => {
    for (const model of OPENROUTER_SVG_MODELS) {
      expect({ id: model.id, nativeVector: isNativeVectorSvgModel(model.id) })
        .toEqual({ id: model.id, nativeVector: model.kind === 'native-vector' });
      expect(svgModelSupportsRefinement(model.id)).toBe(model.kind === 'code');
    }
  });

  it('falls back to the provider for ids the catalog does not list', () => {
    expect(isNativeVectorSvgModel('recraft/recraft-v4-vector')).toBe(true);
    expect(isNativeVectorSvgModel('anthropic/claude-opus-5')).toBe(false);
    expect(isNativeVectorSvgModel('my-org/custom-svg-model')).toBe(false);
  });

  it('follows the catalog kind, not the id prefix, for a curated model', () => {
    jest.isolateModules(() => {
      jest.doMock('../../../shared/models/SVGModels', () => ({
        OPENROUTER_SVG_MODELS: [
          { kind: 'native-vector', id: 'vendor/vector-model', displayName: 'Vector' },
          { kind: 'code', id: 'recraft/code-model', displayName: 'Code', textPricing: { inputPer1M: 1, outputPer1M: 1 }, acceptsImageInput: true },
        ],
      }));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const routes = require('../../../shared/svg/svgRoutes') as typeof import('../../../shared/svg/svgRoutes');
      expect(routes.isNativeVectorSvgModel('vendor/vector-model')).toBe(true);
      expect(routes.isNativeVectorSvgModel('recraft/code-model')).toBe(false);
    });
  });
});
