/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/__tests__/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          strict: false,
          skipLibCheck: true,
          target: 'es2019',
          module: 'commonjs',
          moduleResolution: 'node',
        },
      },
    ],
  },
};
