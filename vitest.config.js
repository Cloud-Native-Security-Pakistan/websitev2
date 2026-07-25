import { defineConfig } from 'vitest/config';

// Test harness for the CNSPK website platform.
// Pure logic in js/lib/ runs in both the browser and Node; these tests
// exercise that shared layer in Node. Single-execution mode only (never watch);
// `--run` is passed by the npm scripts.
export default defineConfig({
  test: {
    // Node environment: the pure-logic modules under js/lib/ have no DOM deps.
    environment: 'node',
    // Collect both the example/unit suite and the fast-check property suite.
    include: ['tests/**/*.test.js'],
    // Property tests can run many iterations; give them headroom.
    testTimeout: 30000,
  },
});
