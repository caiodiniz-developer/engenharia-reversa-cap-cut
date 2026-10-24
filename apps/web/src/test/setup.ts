import * as matchers from '@testing-library/jest-dom/matchers';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

expect.extend(matchers);

afterEach(() => cleanup());

// jsdom não implementa estas APIs usadas pelo editor.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
if (!HTMLCanvasElement.prototype.getContext || !(HTMLCanvasElement.prototype.getContext as { mock?: unknown }).mock) {
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
}

declare module 'vitest' {
  interface Assertion<T = any> extends TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
