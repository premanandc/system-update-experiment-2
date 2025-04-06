/**
 * @type {import('@stryker-mutator/api/core').StrykerOptions}
 */
module.exports = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'jest',
  coverageAnalysis: 'perTest',
  mutate: [
    'src/models/package.ts',
    'src/models/update.ts',
    'src/models/device.ts',
    'src/models/batch.ts',
    'src/models/plan.ts'
  ],
  timeoutMS: 60000,
  concurrency: 4,
  ignorePatterns: ['node_modules', 'dist', 'coverage'],
}; 