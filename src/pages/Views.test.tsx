import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Views } from './Views';
import { apiClient } from '../api/client';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../api/client', () => ({
    apiClient: {
        request: vi.fn(),
    },
}));

const mockZones = [
    { name: 'example.com.', kind: 'Native' },
    { name: '_marker.internal.', kind: 'Native' },
    { name: 'internal-zone..internal.', kind: 'Native' }
];

const mockNetworks = [
    { network: '192.168.1.0/24', view: 'internal' },
    { network: '10.0.0.0/8', view: 'default' }
];

describe('Views Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        render(
            <BrowserRouter>
                <Views />
            </BrowserRouter>
        );
    };

    const setupMocks = () => {
        (apiClient.request as any).mockImplementation((url: string) => {
            if (url === '/servers/localhost/zones') return Promise.resolve(mockZones);
            if (url === '/servers/localhost/networks') return Promise.resolve(mockNetworks);
            return Promise.resolve([]);
        });
    };

    // ==================== FETCH & DISPLAY TESTS ====================

    it('fetches and renders views correctly', async () => {
        setupMocks();
        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('internal')).toBeInTheDocument();
            expect(screen.getByText('default')).toBeInTheDocument();
        });

        expect(screen.getAllByText('1 mapped networks')).toHaveLength(2);
    });

    it('displays loading state initially', async () => {
        let resolvePromise: Function;
        (apiClient.request as any).mockImplementation(() =>
            new Promise(resolve => { resolvePromise = resolve; })
        );

        renderComponent();

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

    // ==================== CREATE VIEW TESTS ====================

    it('creates a new view', async () => {
        const user = userEvent.setup();
        (apiClient.request as any).mockResolvedValue([]);

        renderComponent();

        await user.click(screen.getByTestId('create-view-btn'));

        const input = await screen.findByTestId('view-name-input');
        await user.type(input, 'new_view');

        const mockPost = vi.fn().mockResolvedValue({});
        (apiClient.request as any).mockImplementation((url: string, opts: any) => {
            if (url === '/servers/localhost/zones' && opts?.method === 'POST') {
                return mockPost(url, opts);
            }
            return Promise.resolve([]);
        });

        await user.click(screen.getByTestId('submit-create-view-btn'));

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith('/servers/localhost/zones', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    name: '_marker.new_view.',
                    kind: 'Native',
                    view: 'new_view'
                })
            }));
        });
    });

    // ==================== DELETE VIEW TESTS ====================

    it('handles view deletion with resource cleanup', async () => {
        const complexZones = [
            { name: '_marker.torDelete.', kind: 'Native' },
            { name: 'zone1..torDelete', kind: 'Native' }
        ];
        const complexNetworks = [
            { network: '1.2.3.0/24', view: 'torDelete' }
        ];

        (apiClient.request as any).mockImplementation((url: string) => {
            if (url === '/servers/localhost/zones') return Promise.resolve(complexZones);
            if (url === '/servers/localhost/networks') return Promise.resolve(complexNetworks);
            return Promise.resolve([]);
        });

        renderComponent();

        const viewHeader = await screen.findByText('torDelete');
        const card = viewHeader.closest('.transition-all') as HTMLElement;
        const delButton = within(card).getByTestId('delete-view-btn');

        fireEvent.click(delButton);

        expect(await screen.findByText(/Delete View \"torDelete\"/i)).toBeInTheDocument();

        const confirmBtn = screen.getByRole('button', { name: 'Delete' });
        const user = userEvent.setup();

        const mockDelete = vi.fn().mockResolvedValue({});
        const mockPut = vi.fn().mockResolvedValue({});

        (apiClient.request as any).mockImplementation((url: string, opts: any) => {
            if (opts?.method === 'PUT' && url.includes('/networks/') && !url.includes('%2F')) {
                const err: any = new Error("Not Found");
                err.status = 404;
                return Promise.reject(err);
            }

            if (opts?.method === 'DELETE') return mockDelete(url, opts);
            if (opts?.method === 'PUT') return mockPut(url, opts);

            if (url === '/servers/localhost/zones') return Promise.resolve(complexZones);
            if (url === '/servers/localhost/networks') return Promise.resolve(complexNetworks);
            return Promise.resolve([]);
        });

        await user.click(confirmBtn);

        await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith('/servers/localhost/zones/zone1..torDelete', expect.anything());
            expect(mockPut).toHaveBeenCalledWith('/servers/localhost/networks/1.2.3.0%2F24', expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({ view: '' })
            }));
            expect(mockDelete).toHaveBeenCalledWith('/servers/localhost/zones/_marker.torDelete.', expect.anything());
        });
    });

});

