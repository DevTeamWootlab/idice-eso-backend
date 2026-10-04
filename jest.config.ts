// import type { Config } from 'jest';
// import { pathsToModuleNameMapper } from 'ts-jest';
// import ts from 'typescript';

// const { config: tsconfig } = ts.readConfigFile(
//   './tsconfig.json',
//   ts.sys.readFile,
// );
// const paths = tsconfig?.compilerOptions?.paths ?? {};

// const config: Config = {
//   moduleFileExtensions: ['js', 'json', 'ts'],
//   rootDir: '.',
//   testRegex: '.*\\.spec\\.ts$',
//   transform: {
//     '^.+\\.(t|j)s$': [
//       'ts-jest',
//       {
//         tsconfig: '<rootDir>/tsconfig.json',
//         // Forces ts-jest to output CommonJS during test runs
//         compilerOptions: {
//           module: 'commonjs',
//         },
//       },
//     ],
//   },
//   moduleNameMapper: {
//     // Standard tsconfig path mapping
//     ...pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
//     // Explicit alias fallback for src/ imports on Windows
//     '^src/(.*)$': '<rootDir>/src/$1',
//   },
//   // transformIgnorePatterns: ['node_modules/(?!(@nestjs|@babel|rxjs)/)'],
//   transformIgnorePatterns: ['node_modules/'],
//   collectCoverageFrom: [
//     'src/**/*.(t|j)s',
//     'libs/**/*.(t|j)s',
//     'apps/**/*.(t|j)s',
//   ],
//   coverageDirectory: './coverage',
//   testEnvironment: 'node',
// };

// export default config;

import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  // NestJS 12 is ESM-only. Emit ESM for tests instead of compiling application
  // imports to require(), which cannot load @nestjs/common in Jest's CJS runtime.
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/../tsconfig.spec.json',
      },
    ],
  },

  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@database/(.*)$': '<rootDir>/database/$1',
    // TypeScript ESM output includes .js in relative imports while the source
    // files remain .ts for Jest to transform.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

export default config;
