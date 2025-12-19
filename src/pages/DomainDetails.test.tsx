import { render, screen, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DomainDetails } from './DomainDetails';
import { apiClient } from '../api/client';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../api/client', () => ({
    apiClient: {
        request: vi.fn(),
    },
}));

// Mock zones list (returned by /servers/localhost/zones)
const mockZonesList = [
    { id: 'example.com.', name: 'example.com.', kind: 'Native' }
];

// Mock zone details (returned by /servers/localhost/zones/example.com.)
const mockZoneDetails = {
    id: 'example.com.',
    name: 'example.com.',
    kind: 'Native',
    serial: 2024010101,
    masters: [],
    dnssec: false,
    rrsets: [
        { name: 'example.com.', type: 'SOA', ttl: 3600, records: [{ content: 'ns1.localhost. hostmaster.localhost. 1 10800 3600 604800 3600', disabled: false }] },
        { name: 'www.example.com.', type: 'A', ttl: 300, records: [{ content: '192.168.1.1', disabled: false }] },
        { name: 'api.example.com.', type: 'A', ttl: 300, records: [{ content: '192.168.1.2', disabled: false }] }
    ]
};

describe('DomainDetails Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderWithRouter = (initialEntries = ['/domains/example.com.']) => {
        render(
            <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                    <Route path="/domains/:name" element={<DomainDetails />} />
                </Routes>
            </MemoryRouter>
        );
    };

    const setupMocks = (overrides: Record<string, any> = {}) => {
        (apiClient.request as any).mockImplementation((url: string, opts: any) => {
            if (overrides[url]) return overrides[url](opts);
            if (url === '/servers/localhost/zones') return Promise.resolve(mockZonesList);
            if (url === '/servers/localhost/zones/example.com.') return Promise.resolve(mockZoneDetails);
            return Promise.resolve([]);
        });
    };

    // ==================== FETCH & DISPLAY TESTS ====================

    it('fetches and displays domain records', async () => {
        setupMocks();
        renderWithRouter();

        await waitFor(() => {
            const exampleTexts = screen.getAllByText('example.com.');
            expect(exampleTexts.length).toBeGreaterThan(0);
        });

        expect(screen.getByText('www.example.com.')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
        expect(screen.getByText('api.example.com.')).toBeInTheDocument();
    });

    it('displays loading state initially', async () => {
        // Create a promise that never resolves to keep loading state
        let resolvePromise: Function;
        (apiClient.request as any).mockImplementation(() =>
            new Promise(resolve => { resolvePromise = resolve; })
        );

        renderWithRouter();

        // Loading component renders a spinner with animate-spin class
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();

        // Cleanup: resolve to avoid hanging promise
        resolvePromise!(mockZonesList);
    });

    it('displays error state on API failure', async () => {
        (apiClient.request as any).mockRejectedValue(new Error('Network error'));

        renderWithRouter();

        // Error is displayed in Flash component which has role="alert"
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    // ==================== ADD RECORD TESTS ====================

    it('adds a new record inline', async () => {
        const user = userEvent.setup();
        const mockPatch = vi.fn().mockResolvedValue({});

        setupMocks({
            '/servers/localhost/zones/example.com.': (opts: any) => {
                if (opts?.method === 'PATCH') return mockPatch(opts);
                return Promise.resolve(mockZoneDetails);
            }
        });

        renderWithRouter();
        await screen.findByText('www.example.com.');

        await user.click(screen.getByRole('button', { name: /add record/i }));

        const tbody = document.querySelector('tbody');
        const firstRow = tbody!.querySelector('tr');
        const inputs = within(firstRow!).getAllByRole('textbox');

        await user.clear(inputs[0]);
        await user.type(inputs[0], 'new.example.com.');
        await user.clear(inputs[1]);
        await user.type(inputs[1], '10.0.0.1');

        await user.click(screen.getByTestId('save-record-btn'));

        await waitFor(() => {
            expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({
                method: 'PATCH',
                body: expect.stringContaining('"changetype":"EXTEND"')
            }));
            expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({
                body: expect.stringContaining('"name":"new.example.com."')
            }));
        });
    });

    // ==================== EDIT RECORD TESTS ====================

    it('edits an existing record (content change)', async () => {
        const user = userEvent.setup();
        const mockPatch = vi.fn().mockResolvedValue({});

        setupMocks({
            '/servers/localhost/zones/example.com.': (opts: any) => {
                if (opts?.method === 'PATCH') return mockPatch(opts);
                return Promise.resolve(mockZoneDetails);
            }
        });

        renderWithRouter();
        await screen.findByText('www.example.com.');

        // Click edit button on www record row
        const editButtons = screen.getAllByTestId('edit-record-btn');
        await user.click(editButtons[0]); // First non-SOA record

        // Now InlineEditRow is shown - find content input and modify
        const inputs = screen.getAllByRole('textbox');
        const contentInput = inputs[inputs.length - 1]; // Content is last textbox

        await user.clear(contentInput);
        await user.type(contentInput, '10.10.10.10');

        await user.click(screen.getByTestId('save-record-btn'));

        await waitFor(() => {
            expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({
                method: 'PATCH',
                body: expect.stringContaining('"changetype":"PRUNE"')
            }));
            expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({
                body: expect.stringContaining('"changetype":"EXTEND"')
            }));
            expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({
                body: expect.stringContaining('10.10.10.10')
            }));
        });
    });

    // ==================== DELETE RECORD TESTS ====================

    it('deletes an existing record', async () => {
        const user = userEvent.setup();
        const mockPatch = vi.fn().mockResolvedValue({});

        setupMocks({
            '/servers/localhost/zones/example.com.': (opts: any) => {
                if (opts?.method === 'PATCH') return mockPatch(opts);
                return Promise.resolve(mockZoneDetails);
            }
        });

        renderWithRouter();
        await screen.findByText('www.example.com.');

        // Click edit button to enter edit mode
        const editButtons = screen.getAllByTestId('edit-record-btn');
        await user.click(editButtons[0]);

        // Click delete button (in the InlineEditRow)
        await user.click(screen.getByTestId('delete-record-btn'));

        // Modal appears - find the modal and click its Delete button
        const modalHeading = await screen.findByRole('heading', { name: /delete record/i });
        const modal = modalHeading.closest('[class*="fixed"]');

        // The modal's Delete button is inside the modal container
        const modalButtons = within(modal as HTMLElement).getAllByRole('button');
        const confirmBtn = modalButtons.find(btn => btn.textContent === 'Delete');

        await user.click(confirmBtn!);

        await waitFor(() => {
            expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({
                method: 'PATCH',
                body: expect.stringContaining('"changetype":"PRUNE"')
            }));
        });
    });

    // ==================== SEARCH TESTS ====================

    it('filters records by search query', async () => {
        const user = userEvent.setup();
        setupMocks();
        renderWithRouter();

        await screen.findByText('www.example.com.');
        await screen.findByText('api.example.com.');

        // Type in search box
        const searchInput = screen.getByPlaceholderText(/search/i);
        await user.type(searchInput, 'api');

        // api.example.com should be visible
        expect(screen.getByText('api.example.com.')).toBeInTheDocument();

        // www.example.com should be filtered out
        expect(screen.queryByText('www.example.com.')).not.toBeInTheDocument();
    });

    it('shows no matching records message when search has no results', async () => {
        const user = userEvent.setup();
        setupMocks();
        renderWithRouter();

        await screen.findByText('www.example.com.');

        const searchInput = screen.getByPlaceholderText(/search/i);
        await user.type(searchInput, 'nonexistent');

        await waitFor(() => {
            expect(screen.getByText(/no matching records/i)).toBeInTheDocument();
        });
    });

    // ==================== CANCEL EDIT TESTS ====================

    it('cancels edit mode without saving', async () => {
        const user = userEvent.setup();
        const mockPatch = vi.fn().mockResolvedValue({});

        setupMocks({
            '/servers/localhost/zones/example.com.': (opts: any) => {
                if (opts?.method === 'PATCH') return mockPatch(opts);
                return Promise.resolve(mockZoneDetails);
            }
        });

        renderWithRouter();
        await screen.findByText('www.example.com.');

        // Enter edit mode
        const editButtons = screen.getAllByTestId('edit-record-btn');
        await user.click(editButtons[0]);

        // Click cancel
        await user.click(screen.getByTestId('cancel-edit-btn'));

        // Should exit edit mode without calling API
        expect(mockPatch).not.toHaveBeenCalled();

        // Edit button should be visible again
        expect(screen.getAllByTestId('edit-record-btn').length).toBeGreaterThan(0);
    });
});
