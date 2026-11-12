import { isNativeVectorSvgModel, svgModelRefusal, svgModelSupportsRefinement } from '../../../shared/svg/svgRoutes';
import { OPENROUTER_IMAGE_MODELS, OPENROUTER_SVG_MODELS } from '../../../shared/models';

describe('svgRoutes', () => {
  it('routes every curated model by its catalog kind', () => {
    for (const model of OPENROUTER_SVG_MODELS) {
      expect({ id: model.id, nativeVector: isNativeVectorSvgModel(model.id) })
        .toEqual({ id: model.id, nativeVector: model.kind === 'native-vector' });
      expect(svgModelSupportsRefinement(model.id)).toBe(model.kind === 'code');
    }
  });

  it('routes an id the catalog does not list by a -vector name, not by the recraft/ prefix', () => {
    expect(isNativeVectorSvgModel('recraft/recraft-v4-vector')).toBe(true);
    expect(isNativeVectorSvgModel('recraft/recraft-v9-pro-vector:free')).toBe(true);
    expect(isNativeVectorSvgModel('acme/logo-vector')).toBe(true);
    // Raster Recraft ids (the Image catalog's) would be billed on the vector route, then fail.
    for (const raster of ['recraft/recraft-v4.1', 'recraft/recraft-v4.1-flash', 'recraft/recraft-v4-styles', 'recraft/recraft-v9']) {
      expect({ raster, nativeVector: isNativeVectorSvgModel(raster) }).toEqual({ raster, nativeVector: false });
      expect(svgModelSupportsRefinement(raster)).toBe(true);
    }
    expect(isNativeVectorSvgModel('acme/vector-art')).toBe(false);
    expect(isNativeVectorSvgModel('anthropic/claude-opus-5')).toBe(false);
    expect(isNativeVectorSvgModel('my-org/custom-svg-model')).toBe(false);
  });

  it('refuses known raster image models before either route could bill them', () => {
    for (const model of OPENROUTER_IMAGE_MODELS) {
      expect(svgModelRefusal(model.id)).toBe(`${model.id} makes raster images, not SVG. Use it on the Image tab, or choose a vector (-vector) or text model for SVG.`);
    }
    // An unlisted Recraft id without a vector name is raster too.
    expect(svgModelRefusal('recraft/recraft-v9')).toMatch(/makes raster images/);
    // Curated SVG models, vector names and other ids are left to their route.
    for (const ok of [...OPENROUTER_SVG_MODELS.map(model => model.id), 'recraft/recraft-v9-vector', 'acme/logo-vector', 'acme/svg-writer', 'openai/gpt-6.1-sol']) {
      expect({ ok, refusal: svgModelRefusal(ok) }).toEqual({ ok, refusal: null });
    }
  });

  it('classifies the model an id names, whatever its :variant or casing (PR #18 R18-1)', () => {
    for (const model of OPENROUTER_IMAGE_MODELS) {
      for (const id of [`${model.id}:nitro`, `${model.id}:floor`, model.id.toUpperCase(), `${model.id.toUpperCase()}:free`]) {
        expect({ id, refusal: svgModelRefusal(id) }).toEqual({ id, refusal: `${id} makes raster images, not SVG. Use it on the Image tab, or choose a vector (-vector) or text model for SVG.` });
      }
    }
    expect(svgModelRefusal('Recraft/Recraft-V9:nitro')).toMatch(/makes raster images/);
    for (const model of OPENROUTER_SVG_MODELS) {
      for (const id of [`${model.id}:nitro`, model.id.toUpperCase()]) {
        expect({ id, refusal: svgModelRefusal(id), nativeVector: isNativeVectorSvgModel(id) })
          .toEqual({ id, refusal: null, nativeVector: model.kind === 'native-vector' });
      }
    }
    for (const ok of ['recraft/recraft-v9-vector:floor', 'Acme/Logo-Vector', 'openai/gpt-6.1-sol:nitro', 'acme/svg-writer:free']) {
      expect({ ok, refusal: svgModelRefusal(ok) }).toEqual({ ok, refusal: null });
    }
    expect(isNativeVectorSvgModel('Recraft/Recraft-V9-Vector:floor')).toBe(true);
    expect(isNativeVectorSvgModel('recraft/recraft-v4.1:floor')).toBe(false);
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
