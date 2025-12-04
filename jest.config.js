/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
      },
    },
  },
  moduleNameMapper: {
    // Mock CSS imports for tests
    '\\.css$': '<rootDir>/src/__tests__/__mocks__/styleMock.js',
    // Support path aliases in tests (order matters - most specific first)
    '^@messages$': '<rootDir>/src/shared/types/messages/index.ts',
    '^@messages/(.*)$': '<rootDir>/src/shared/types/messages/$1',
    '^@formatters$': '<rootDir>/src/presentation/webview/utils/formatters',
    '^@formatters/(.*)$': '<rootDir>/src/presentation/webview/utils/formatters/$1',
    '^@standards$': '<rootDir>/src/infrastructure/standards',
    '^@secrets$': '<rootDir>/src/infrastructure/secrets',
    '^@ai$': '<rootDir>/src/infrastructure/ai',
    '^@logging$': '<rootDir>/src/infrastructure/logging',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@handlers/(.*)$': '<rootDir>/src/application/handlers/$1',
    '^@services/(.*)$': '<rootDir>/src/infrastructure/api/services/$1',
    '^@components/(.*)$': '<rootDir>/src/presentation/webview/components/$1',
    '^@hooks/(.*)$': '<rootDir>/src/presentation/webview/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/src/presentation/webview/utils/$1',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts'
  ],
  coverageDirectory: './coverage'
};
