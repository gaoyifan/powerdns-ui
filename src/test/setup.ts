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
