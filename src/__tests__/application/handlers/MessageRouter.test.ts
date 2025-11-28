/**
 * MessageRouter tests
 *
 * Tests the strategy pattern message routing functionality
 */
import { MessageRouter, MessageHandlerFn } from '../../../application/handlers/MessageRouter';
import { MessageType, MessageEnvelope, createEnvelope } from '@messages';

describe('MessageRouter', () => {
  let router: MessageRouter;

  beforeEach(() => {
    router = new MessageRouter();
  });

  describe('register', () => {
    it('should register a handler for a message type', () => {
      const handler: MessageHandlerFn = jest.fn();
      router.register(MessageType.HELLO_WORLD_REQUEST, handler);

      expect(router.hasHandler(MessageType.HELLO_WORLD_REQUEST)).toBe(true);
    });

    it('should overwrite existing handler when registering same type', () => {
      const handler1: MessageHandlerFn = jest.fn();
      const handler2: MessageHandlerFn = jest.fn();

      router.register(MessageType.HELLO_WORLD_REQUEST, handler1);
      router.register(MessageType.HELLO_WORLD_REQUEST, handler2);

      expect(router.getRegisteredTypes()).toHaveLength(1);
    });
  });

  describe('unregister', () => {
    it('should remove a registered handler', () => {
      const handler: MessageHandlerFn = jest.fn();
      router.register(MessageType.HELLO_WORLD_REQUEST, handler);

      router.unregister(MessageType.HELLO_WORLD_REQUEST);

      expect(router.hasHandler(MessageType.HELLO_WORLD_REQUEST)).toBe(false);
    });

    it('should do nothing when unregistering non-existent handler', () => {
      expect(() => router.unregister(MessageType.HELLO_WORLD_REQUEST)).not.toThrow();
    });
  });

  describe('route', () => {
    it('should call the correct handler for a message', async () => {
      const handler: MessageHandlerFn = jest.fn();
      router.register(MessageType.HELLO_WORLD_REQUEST, handler);

      const message = createEnvelope(
        MessageType.HELLO_WORLD_REQUEST,
        'webview.helloWorld',
        { text: 'test' }
      );

      const result = await router.route(message);

      expect(handler).toHaveBeenCalledWith(message);
      expect(result).toBe(true);
    });

    it('should return false when no handler exists', async () => {
      const message = createEnvelope(
        MessageType.HELLO_WORLD_REQUEST,
        'webview.helloWorld',
        { text: 'test' }
      );

      const result = await router.route(message);

      expect(result).toBe(false);
    });

    it('should handle async handlers', async () => {
      const asyncHandler: MessageHandlerFn = jest.fn().mockResolvedValue(undefined);
      router.register(MessageType.HELLO_WORLD_REQUEST, asyncHandler);

      const message = createEnvelope(
        MessageType.HELLO_WORLD_REQUEST,
        'webview.helloWorld',
        { text: 'test' }
      );

      const result = await router.route(message);

      expect(asyncHandler).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should propagate errors from handlers', async () => {
      const errorHandler: MessageHandlerFn = jest.fn().mockRejectedValue(new Error('Handler error'));
      router.register(MessageType.HELLO_WORLD_REQUEST, errorHandler);

      const message = createEnvelope(
        MessageType.HELLO_WORLD_REQUEST,
        'webview.helloWorld',
        { text: 'test' }
      );

      await expect(router.route(message)).rejects.toThrow('Handler error');
    });
  });

  describe('hasHandler', () => {
    it('should return true for registered handler', () => {
      router.register(MessageType.HELLO_WORLD_REQUEST, jest.fn());
      expect(router.hasHandler(MessageType.HELLO_WORLD_REQUEST)).toBe(true);
    });

    it('should return false for unregistered handler', () => {
      expect(router.hasHandler(MessageType.HELLO_WORLD_REQUEST)).toBe(false);
    });
  });

  describe('getRegisteredTypes', () => {
    it('should return empty array when no handlers registered', () => {
      expect(router.getRegisteredTypes()).toEqual([]);
    });

    it('should return all registered message types', () => {
      router.register(MessageType.HELLO_WORLD_REQUEST, jest.fn());
      router.register(MessageType.REQUEST_SETTINGS, jest.fn());
      router.register(MessageType.SAVE_API_KEY, jest.fn());

      const types = router.getRegisteredTypes();

      expect(types).toHaveLength(3);
      expect(types).toContain(MessageType.HELLO_WORLD_REQUEST);
      expect(types).toContain(MessageType.REQUEST_SETTINGS);
      expect(types).toContain(MessageType.SAVE_API_KEY);
    });
  });
});
