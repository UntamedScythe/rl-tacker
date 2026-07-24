// Vitest stub for the `server-only` package.
// Next.js's own bundler enforces the server/client boundary at build time and
// swaps this import for a no-op there; outside that pipeline (i.e. under
// vitest/Node) the real package unconditionally throws, so tests alias it here.
export {}
