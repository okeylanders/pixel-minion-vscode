/** @jest-environment jsdom */
/**
 * The SVG attachment is text context, never an image reference: the uploader
 * keeps it out of the route's raster count, always offers it, and never adds
 * an SVG whose markup it couldn't read (that would go out as an image).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImageUploader } from '../../../../../presentation/webview/components/image/ImageUploader';

const png = (name: string) => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });
const svg = (markup: string) => new File([markup], 'logo.svg', { type: 'image/svg+xml' });
const pick = (container: HTMLElement, files: File[]) =>
  fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files } });

it('adds the SVG beside a full raster allowance and drops only the extra rasters', async () => {
  const onAddImage = jest.fn();
  const { container } = render(
    <ImageUploader images={[]} onAddImage={onAddImage} onRemoveImage={jest.fn()} onClear={jest.fn()} maxImages={1} />
  );
  pick(container, [png('a.png'), svg('<svg/>'), png('b.png')]);
  await waitFor(() => expect(onAddImage).toHaveBeenCalledTimes(2));
  const svgCalls = onAddImage.mock.calls.filter(([, text]) => text);
  expect(svgCalls).toEqual([[expect.stringMatching(/^data:image\/svg\+xml/), '<svg/>']]);
  expect(onAddImage.mock.calls.filter(([, text]) => !text)).toHaveLength(1);
});

it('counts rasters only, and offers SVG context once the raster slots are full', () => {
  const images = ['data:image/svg+xml;base64,PHN2Zy8+', 'data:image/png;base64,QUJD'];
  const { container } = render(
    <ImageUploader images={images} svgIndex={0} onAddImage={jest.fn()} onRemoveImage={jest.fn()} onClear={jest.fn()} maxImages={1} />
  );
  const button = screen.getByRole('button', { name: /Add SVG Context \(1\/1\)/ }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  expect((container.querySelector('input[type="file"]') as HTMLInputElement).accept).toBe('image/svg+xml');
  expect(screen.getByRole('img', { name: 'SVG text context' })).toBeTruthy();
});

it('offers rasters and SVG while slots remain, whatever raster formats the route narrows to', () => {
  const { container } = render(
    <ImageUploader images={['data:image/svg+xml;base64,PHN2Zy8+']} svgIndex={0} onAddImage={jest.fn()} onRemoveImage={jest.fn()} onClear={jest.fn()}
      maxImages={2} accept="image/png,image/jpeg,image/webp" />
  );
  // The SVG holds no slot: the label shows no raster count yet.
  expect(screen.getByRole('button', { name: '+ Add Reference Image' })).toBeTruthy();
  expect((container.querySelector('input[type="file"]') as HTMLInputElement).accept).toBe('image/png,image/jpeg,image/webp,image/svg+xml');
});

it('skips an SVG whose markup is empty rather than adding it as an image', async () => {
  const onAddImage = jest.fn();
  const { container } = render(
    <ImageUploader images={[]} onAddImage={onAddImage} onRemoveImage={jest.fn()} onClear={jest.fn()} maxImages={1} />
  );
  pick(container, [svg('   '), png('a.png')]);
  await waitFor(() => expect(onAddImage).toHaveBeenCalledTimes(1));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(onAddImage).toHaveBeenCalledTimes(1);
  expect(onAddImage.mock.calls[0][1]).toBeUndefined();
});
