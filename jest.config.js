/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Webview component tests are `.test.tsx` and opt into jsdom per file with a
  // `/** @jest-environment jsdom */` docblock; host tests stay on node.
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    // tsconfig.test.json = tsconfig.json + JSX + DOM lib + the webview aliases.
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleNameMapper: {
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
    '^@hooks$': '<rootDir>/src/presentation/webview/hooks',
    '^@hooks/(.*)$': '<rootDir>/src/presentation/webview/hooks/$1',
    '^@providers/(.*)$': '<rootDir>/src/infrastructure/ai/providers/$1',
    // Components import their stylesheets for side effects; tests don't need them.
    '\\.css$': '<rootDir>/src/__tests__/styleMock.js',
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
