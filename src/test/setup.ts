import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
    cleanup();
});

// Mock apiClient globally if desired, or per test file.
// For now, we will reset mocks between tests.
afterEach(() => {
    vi.clearAllMocks();
});

// Polyfill matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Polyfill ResizeObserver
vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
        observe() { }
        unobserve() { }
        disconnect() { }
    }
);
