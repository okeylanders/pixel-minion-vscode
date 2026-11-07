/**
 * Save and clear outcomes of the Image and SVG handlers: exactly one save
 * result per request, a cancelled dialog is reported as cancelled (never as
 * saved or as an error), opening the file can't reverse a completed write,
 * the image extension follows the bytes, and a refused clear is reported to
 * the request that asked for it.
 */
import * as vscode from 'vscode';
import { MessageEnvelope, MessageType, createEnvelope } from '@messages';
import { ImageGenerationHandler } from '../../../../application/handlers/domain/ImageGenerationHandler';
import { SVGGenerationHandler } from '../../../../application/handlers/domain/SVGGenerationHandler';
import type { ImageOrchestrator, SVGOrchestrator } from '@ai';
import type { LoggingService } from '@logging';

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as LoggingService;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64');
const WEBP = Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'binary').toString('base64');
const TIFF = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0, 0, 0, 0]).toString('base64');

type MockedVscode = {
  window: { showSaveDialog: jest.Mock };
  workspace: { workspaceFolders: unknown; getConfiguration: jest.Mock; fs: { writeFile: jest.Mock; createDirectory?: jest.Mock } };
  commands: { executeCommand: jest.Mock };
};
const host = vscode as unknown as MockedVscode;

let posted: MessageEnvelope[];
const postMessage = (message: MessageEnvelope) => { posted.push(message); };
const results = (type: MessageType) => posted.filter((m) => m.type === type);

beforeEach(() => {
  posted = [];
  jest.clearAllMocks();
  host.window.showSaveDialog = jest.fn();
  host.workspace.workspaceFolders = [{ uri: { fsPath: '/w', path: '/w' } }];
  host.workspace.getConfiguration = jest.fn(() => ({ get: (_key: string, fallback: unknown) => fallback, update: jest.fn() }));
  host.workspace.fs.writeFile = jest.fn().mockResolvedValue(undefined);
  host.workspace.fs.createDirectory = jest.fn().mockResolvedValue(undefined);
  host.commands.executeCommand = jest.fn().mockResolvedValue(undefined);
});

describe('ImageGenerationHandler save', () => {
  const handler = () => new ImageGenerationHandler(postMessage, {} as ImageOrchestrator, logger);
  const save = (data: string, mimeType: string, suggestedFilename = 'pixel-minion-a.jpg') =>
    createEnvelope(MessageType.IMAGE_SAVE_REQUEST, 'webview.imageGeneration',
      { imageId: 'img-1', data, mimeType, suggestedFilename }, 'image-save-1');

  it('saves WebP bytes as .webp, whatever extension was suggested', async () => {
    await handler().handleSaveRequest(save(`data:image/webp;base64,${WEBP}`, 'image/webp'));

    const [uri] = host.workspace.fs.writeFile.mock.calls[0];
    expect(uri.fsPath).toBe('/w/pixel-minion/pixel-minion-a.webp');
    expect(results(MessageType.IMAGE_SAVE_RESULT)).toEqual([expect.objectContaining({
      correlationId: 'image-save-1',
      payload: { success: true, imageId: 'img-1', filePath: '/w/pixel-minion/pixel-minion-a.webp' },
    })]);
  });

  it('trusts the bytes over a wrong MIME label', async () => {
    await handler().handleSaveRequest(save(`data:image/jpeg;base64,${PNG}`, 'image/jpeg'));

    expect(host.workspace.fs.writeFile.mock.calls[0][0].fsPath).toMatch(/\.png$/);
  });

  it('refuses data it cannot identify instead of writing a .jpg', async () => {
    await handler().handleSaveRequest(save(`data:image/tiff;base64,${TIFF}`, 'image/tiff'));

    expect(host.workspace.fs.writeFile).not.toHaveBeenCalled();
    const [result] = results(MessageType.IMAGE_SAVE_RESULT);
    expect(result.payload).toMatchObject({ success: false, imageId: 'img-1' });
    expect((result.payload as { error: string }).error).toContain('image/tiff');
  });

  it('reports a cancelled save dialog as cancelled, not as an error', async () => {
    host.workspace.workspaceFolders = [];
    host.window.showSaveDialog.mockResolvedValue(undefined);

    await handler().handleSaveRequest(save(`data:image/png;base64,${PNG}`, 'image/png'));

    expect(host.window.showSaveDialog.mock.calls[0][0].filters.Images).toEqual(['png']);
    expect(host.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(results(MessageType.IMAGE_SAVE_RESULT).map((m) => m.payload)).toEqual([
      { success: false, cancelled: true, imageId: 'img-1' },
    ]);
  });

  it('keeps a completed write successful when the editor cannot open it', async () => {
    host.commands.executeCommand.mockRejectedValue(new Error('no editor'));

    await handler().handleSaveRequest(save(`data:image/png;base64,${PNG}`, 'image/png'));

    expect(results(MessageType.IMAGE_SAVE_RESULT).map((m) => m.payload)).toEqual([
      expect.objectContaining({ success: true }),
    ]);
  });

  it('reports a refused clear to the request that asked for it', () => {
    const orchestrator = { clearConversation: jest.fn(() => { throw new Error('Wait for image generation'); }) };
    new ImageGenerationHandler(postMessage, orchestrator as unknown as ImageOrchestrator, logger)
      .handleClearConversation(createEnvelope(MessageType.IMAGE_GENERATION_CLEAR, 'webview.imageGeneration',
        { conversationId: 'img-1' }, 'image-clear-1'));

    expect(results(MessageType.ERROR)).toEqual([expect.objectContaining({
      correlationId: 'image-clear-1',
      payload: expect.objectContaining({ message: 'Wait for image generation' }),
    })]);
  });
});

describe('save file names', () => {
  const imageSave = (suggestedFilename: string) => createEnvelope(MessageType.IMAGE_SAVE_REQUEST, 'webview.imageGeneration',
    { imageId: 'img-1', data: `data:image/png;base64,${PNG}`, mimeType: 'image/png', suggestedFilename }, 'image-save-1');
  const svgSave = (suggestedFilename: string) => createEnvelope(MessageType.SVG_SAVE_REQUEST, 'webview.svgGeneration',
    { svgCode: '<svg xmlns="http://www.w3.org/2000/svg"/>', suggestedFilename }, 'svg-save-1');

  it.each(['../escape.png', 'nested/escape.png', '..\\escape.png', 'C:escape.png', '.hidden.png', 'a\u0000b.png'])(
    'refuses the image name %p without writing anything', async (name) => {
      await new ImageGenerationHandler(postMessage, {} as ImageOrchestrator, logger).handleSaveRequest(imageSave(name));

      expect(host.workspace.fs.writeFile).not.toHaveBeenCalled();
      expect(results(MessageType.IMAGE_SAVE_RESULT).map((m) => m.payload)).toEqual([
        expect.objectContaining({ success: false, error: expect.stringContaining('plain name') }),
      ]);
    }
  );

  it.each(['../../escape.svg', '/etc/escape.svg', 'sub\\escape.svg'])(
    'refuses the SVG name %p without writing anything', async (name) => {
      await new SVGGenerationHandler(postMessage, {} as SVGOrchestrator, logger).handleSaveRequest(svgSave(name));

      expect(host.workspace.fs.writeFile).not.toHaveBeenCalled();
      expect((results(MessageType.SVG_SAVE_RESULT)[0].payload as { error: string }).error).toContain('plain name');
    }
  );
});

describe('SVGGenerationHandler save', () => {
  const handler = () => new SVGGenerationHandler(postMessage, {} as SVGOrchestrator, logger);
  const save = () => createEnvelope(MessageType.SVG_SAVE_REQUEST, 'webview.svgGeneration',
    { svgCode: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>', suggestedFilename: 'pixel-minion-a.svg' }, 'svg-save-1');

  it('reports a cancelled save dialog as cancelled, not as an error', async () => {
    host.workspace.workspaceFolders = [];
    host.window.showSaveDialog.mockResolvedValue(undefined);

    await handler().handleSaveRequest(save());

    expect(results(MessageType.SVG_SAVE_RESULT).map((m) => m.payload)).toEqual([{ success: false, cancelled: true }]);
  });

  it('never writes a document the SVG policy rejects', async () => {
    await handler().handleSaveRequest(createEnvelope(MessageType.SVG_SAVE_REQUEST, 'webview.svgGeneration',
      { svgCode: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', suggestedFilename: 'a.svg' },
      'svg-save-2'));

    expect(host.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(host.window.showSaveDialog).not.toHaveBeenCalled();
    expect(results(MessageType.SVG_SAVE_RESULT).map((m) => m.payload)).toEqual([
      { success: false, error: 'Not saved: this SVG contains a <script> element.' },
    ]);
  });

  it('keeps a completed write successful when the editor cannot open it', async () => {
    host.commands.executeCommand.mockRejectedValue(new Error('no editor'));

    await handler().handleSaveRequest(save());

    expect(results(MessageType.SVG_SAVE_RESULT)).toEqual([expect.objectContaining({
      correlationId: 'svg-save-1',
      payload: { success: true, filePath: '/w/pixel-minion/pixel-minion-a.svg' },
    })]);
  });
});
