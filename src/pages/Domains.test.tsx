import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Domains } from './Domains';
import { apiClient } from '../api/client';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../api/client', () => ({
    apiClient: {
        request: vi.fn(),
    },
}));

const mockZones = [
    { id: 'example.com.', name: 'example.com.', kind: 'Native', serial: 2024010101, masters: [], dnssec: false, account: '' },
    { id: 'test.com.', name: 'test.com.', kind: 'Native', serial: 2024010101, masters: [], dnssec: true, account: '' }
];

const mockServerInfo = {
    version: '4.8.0',
    daemon_type: 'authoritative',
    id: 'localhost',
    type: 'Server',
    url: '/api/v1/servers/localhost'
};

describe('Domains Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <Domains />
            </BrowserRouter>
        );
    };

    const setupMocks = (overrides: Record<string, any> = {}) => {
        (apiClient.request as any).mockImplementation((url: string, opts: any) => {
            if (overrides[url]) return overrides[url](opts);
            if (url === '/servers/localhost') return Promise.resolve(mockServerInfo);
            if (url === '/servers/localhost/zones') return Promise.resolve(mockZones);
            if (url === '/servers/localhost/statistics') return Promise.resolve([]);
            return Promise.resolve([]);
        });
    };

    // ==================== FETCH & DISPLAY TESTS ====================

    it('fetches and renders domains', async () => {
        setupMocks();
        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('example.com.')).toBeInTheDocument();
            expect(screen.getByText('test.com.')).toBeInTheDocument();
        });
    });

    it('displays loading state initially', async () => {
        let resolvePromise: Function;
        (apiClient.request as any).mockImplementation(() =>
            new Promise(resolve => { resolvePromise = resolve; })
        );

        renderComponent();

        // StatsCard shows loading state via skeleton/spinner
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();

        resolvePromise!([]);
    });

    it('displays error state on API failure', async () => {
        (apiClient.request as any).mockRejectedValue(new Error('Network error'));

        renderComponent();

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    // ==================== CREATE ZONE TESTS ====================

    it('creates a new zone', async () => {
        const user = userEvent.setup();
        const mockPost = vi.fn().mockResolvedValue({ id: 'new-zone.com.', name: 'new-zone.com.' });

        (apiClient.request as any).mockImplementation((url: string, opts: any) => {
            if (url === '/servers/localhost') return Promise.resolve(mockServerInfo);
            if (opts?.method === 'POST') return mockPost(url, opts);
            if (url === '/servers/localhost/statistics') return Promise.resolve([]);
            if (url === '/servers/localhost/zones') return Promise.resolve([]);
            return Promise.resolve([]);
        });

        renderComponent();

        await user.click(screen.getByTestId('create-zone-btn'));

        const input = await screen.findByTestId('zone-name-input');
        await user.type(input, 'new-zone.com');

        await user.click(screen.getByTestId('submit-create-zone-btn'));

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith('/servers/localhost/zones', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    name: 'new-zone.com.',
                    kind: 'Native',
                    nameservers: []
                })
            }));
        });
    });

    // ==================== DELETE ZONE TESTS ====================

    it('deletes a zone', async () => {
        const user = userEvent.setup();
        const mockDelete = vi.fn().mockResolvedValue({});

        (apiClient.request as any).mockImplementation((url: string, opts: any) => {
            if (url === '/servers/localhost') return Promise.resolve(mockServerInfo);
            if (opts?.method === 'DELETE') return mockDelete(url, opts);
            if (url === '/servers/localhost/zones') return Promise.resolve(mockZones);
            if (url === '/servers/localhost/statistics') return Promise.resolve([]);
            return Promise.resolve([]);
        });

        renderComponent();

        const zoneText = await screen.findByText('example.com.');
        expect(zoneText).toBeInTheDocument();

        const deleteButtons = screen.getAllByTestId('delete-zone-btn');
        expect(deleteButtons.length).toBeGreaterThan(0);

        await user.click(deleteButtons[0]);

        const modalTitle = await screen.findByRole('heading', { name: /Delete Domain/i });
        expect(modalTitle).toBeInTheDocument();

        const confirmBtn = screen.getByRole('button', { name: 'Delete' });
        await user.click(confirmBtn);

        await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith('/servers/localhost/zones/example.com.', expect.objectContaining({
                method: 'DELETE'
            }));
        });
    });
});
