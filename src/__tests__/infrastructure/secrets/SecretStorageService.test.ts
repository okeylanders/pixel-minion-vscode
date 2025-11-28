/**
 * SecretStorageService tests
 *
 * Tests secure API key storage functionality
 */
import { SecretStorageService } from '../../../infrastructure/secrets/SecretStorageService';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const createMockSecrets = () => ({
  get: jest.fn(),
  store: jest.fn(),
  delete: jest.fn(),
  onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
});

describe('SecretStorageService', () => {
  let mockSecrets: ReturnType<typeof createMockSecrets>;
  let service: SecretStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSecrets = createMockSecrets();
    service = new SecretStorageService(mockSecrets as never, mockLogger as never);
  });

  describe('getApiKey', () => {
    it('should return stored API key', async () => {
      mockSecrets.get.mockResolvedValue('sk-test-key-123');

      const result = await service.getApiKey();

      expect(result).toBe('sk-test-key-123');
      expect(mockSecrets.get).toHaveBeenCalledWith('openRouterApiKey');
    });

    it('should return undefined when no key stored', async () => {
      mockSecrets.get.mockResolvedValue(undefined);

      const result = await service.getApiKey();

      expect(result).toBeUndefined();
    });

    it('should handle errors and return undefined', async () => {
      mockSecrets.get.mockRejectedValue(new Error('Storage error'));

      const result = await service.getApiKey();

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to retrieve API key from SecretStorage',
        expect.any(Error)
      );
    });
  });

  describe('setApiKey', () => {
    it('should store API key successfully', async () => {
      mockSecrets.store.mockResolvedValue(undefined);

      await service.setApiKey('sk-new-key');

      expect(mockSecrets.store).toHaveBeenCalledWith('openRouterApiKey', 'sk-new-key');
      expect(mockLogger.info).toHaveBeenCalledWith('API key stored successfully');
    });

    it('should throw on storage error', async () => {
      const error = new Error('Storage failed');
      mockSecrets.store.mockRejectedValue(error);

      await expect(service.setApiKey('sk-key')).rejects.toThrow('Storage failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to store API key in SecretStorage',
        error
      );
    });
  });

  describe('deleteApiKey', () => {
    it('should delete API key successfully', async () => {
      mockSecrets.delete.mockResolvedValue(undefined);

      await service.deleteApiKey();

      expect(mockSecrets.delete).toHaveBeenCalledWith('openRouterApiKey');
      expect(mockLogger.info).toHaveBeenCalledWith('API key deleted successfully');
    });

    it('should throw on delete error', async () => {
      const error = new Error('Delete failed');
      mockSecrets.delete.mockRejectedValue(error);

      await expect(service.deleteApiKey()).rejects.toThrow('Delete failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete API key from SecretStorage',
        error
      );
    });
  });

  describe('hasApiKey', () => {
    it('should return true when API key exists', async () => {
      mockSecrets.get.mockResolvedValue('sk-key');

      const result = await service.hasApiKey();

      expect(result).toBe(true);
    });

    it('should return false when API key is undefined', async () => {
      mockSecrets.get.mockResolvedValue(undefined);

      const result = await service.hasApiKey();

      expect(result).toBe(false);
    });

    it('should return false when API key is empty string', async () => {
      mockSecrets.get.mockResolvedValue('');

      const result = await service.hasApiKey();

      expect(result).toBe(false);
    });
  });

  describe('onDidChange', () => {
    it('should register change listener', () => {
      const listener = jest.fn();
      const mockDisposable = { dispose: jest.fn() };
      mockSecrets.onDidChange.mockReturnValue(mockDisposable);

      const disposable = service.onDidChange(listener);

      expect(mockSecrets.onDidChange).toHaveBeenCalled();
      expect(disposable).toBe(mockDisposable);
    });

    it('should call listener when secrets change', () => {
      const listener = jest.fn();

      // Capture the callback passed to onDidChange
      let capturedCallback: () => void = () => {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockSecrets.onDidChange as jest.Mock).mockImplementation((cb: any) => {
        capturedCallback = cb;
        return { dispose: jest.fn() };
      });

      service.onDidChange(listener);

      // Simulate a secret change
      capturedCallback();

      expect(listener).toHaveBeenCalled();
    });
  });
});
