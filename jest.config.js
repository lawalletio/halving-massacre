/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports =  {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
  coveragePathIgnorePatterns: ['<rootDir>/src/index.ts', '\\.test\\.ts'],
  coverageDirectory: '<rootDir>/dist/.coverage',
  coverageProvider: 'babel',
  extensionsToTreatAsEsm: [".ts"],
  logHeapUsage: true,
  passWithNoTests: true,
  //preset: 'ts-jest',
  randomize: true,
  resetModules: true,
  restoreMocks: false,
  rootDir: '.',
  setupFiles: [ 'dotenv/config' ],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '\\.ts': [
      'ts-jest',
      {
        diagnostics: {
          ignoreCodes: [1343]
        },
        astTransformers: {
          before: [
            {
              path: 'ts-jest-mock-import-meta'
            }
          ]
        }
      }
    ]
  },
  maxWorkers: 1,
  moduleNameMapper: {
    "^@constants/(.*)$": '<rootDir>/src/constants/$1',
    "^@lib/(.*)$": '<rootDir>/src/lib/$1',
    "^@mocks/(.*)$": '<rootDir>/__mocks__/$1',
    "^@nostr/(.*)$": '<rootDir>/src/nostr/$1',
    "^@rest/(.*)$": '<rootDir>/src/rest/$1',
    "^@services/(.*)$": '<rootDir>/src/services/$1',
    "^@src/(.*)$": '<rootDir>/src/$1',
    "^@type/(.*)$": '<rootDir>/src/type/$1',
  },
};
