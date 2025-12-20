import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Views } from './Views';
import { apiClient } from '../api/client';
import { pdns } from '../api/pdns';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// Configure API for test environment
const TEST_API_KEY = 'secret';
const TEST_BASE_URL = 'http://127.0.0.1:8081/api/v1';

describe('Views Page (Live API)', () => {
    let createdViews: string[] = [];
    let initialViewName: string;

    beforeAll(async () => {
        apiClient.configure({ apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL });

        // Create an initial view for read tests
        initialViewName = `view-init-${Date.now()}`;
        try {
            await pdns.createZone({
                name: `init.${initialViewName}..${initialViewName}`,
                kind: 'Native',
                nameservers: []
            });
            await pdns.createView(initialViewName, `init.${initialViewName}..${initialViewName}`);
            createdViews.push(initialViewName);
        } catch (e) {
            console.error(e);
        }
    });

    afterAll(async () => {
        for (const view of createdViews) {
            try {
                const { zones } = await pdns.getViewZones(view);
                for (const zoneVariant of zones) {
                    // Cleanup zone variant from view, then delete zone
                    // Heuristic: remove `..${view}` suffix, ensuring trailing dot
                    const suffix = `..${view}`;
                    if (zoneVariant.endsWith(suffix)) {
                        const baseName = zoneVariant.slice(0, -suffix.length) + '.';
                        await pdns.deleteViewZone(view, baseName).catch(() => { });
                    }
                    await pdns.deleteZone(zoneVariant).catch(() => { });
                }
            } catch (e) {
                // ignore
            }
        }
    });

    const createTestView = async (prefix: string) => {
        const viewName = `${prefix}-${Date.now()}`;
        const zoneName = `test.${viewName}..${viewName}`;

        await pdns.createZone({
            name: zoneName,
            kind: 'Native',
            nameservers: []
        });
        await pdns.createView(viewName, zoneName);
        createdViews.push(viewName);
        return viewName;
    };

    const renderComponent = () => {
        render(
            <BrowserRouter>
                <Views />
            </BrowserRouter>
        );
    };

    it('fetches and renders views correctly', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByText(initialViewName)).toBeInTheDocument();
            expect(screen.getByText('default')).toBeInTheDocument();
        });
    });

    it('displays error state on API failure', async () => {
        apiClient.configure({ baseUrl: 'http://localhost:9999/api/v1' });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        apiClient.configure({ baseUrl: TEST_BASE_URL });
    });

    it('creates a new view', async () => {
        const user = userEvent.setup();
        const newViewName = `view-create-${Date.now()}`;

        renderComponent();

        await user.click(screen.getByTestId('create-view-btn'));

        const input = await screen.findByTestId('view-name-input');
        await user.type(input, newViewName);


        await user.click(screen.getByTestId('submit-create-view-btn'));

        await waitFor(async () => {
            expect(screen.getByText(newViewName)).toBeInTheDocument();
            // Verify backend
            const { views } = await pdns.getViews();
            expect(views).toContain(newViewName);
        });
        createdViews.push(newViewName);
    });

    it('handles view deletion with resource cleanup', async () => {
        const user = userEvent.setup();
        const deleteViewName = await createTestView('view-del');

        // Render
        renderComponent();

        const viewHeader = await screen.findByText(deleteViewName);
        const card = viewHeader.closest('.transition-all') as HTMLElement;
        const delButton = within(card).getByTestId('delete-view-btn');

        fireEvent.click(delButton);

        const heading = await screen.findByText(new RegExp(`Delete View "${deleteViewName}"`, 'i'));
        expect(heading).toBeInTheDocument();

        const confirmBtn = screen.getByRole('button', { name: 'Delete' });
        await user.click(confirmBtn);

        await waitFor(() => {
            expect(screen.queryByText(deleteViewName)).not.toBeInTheDocument();
        });
    });

    it('updates text area when fetching from URL', async () => {
        const originalFetch = window.fetch;
        // Mock external fetch only
        const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
            const urlStr = input.toString();
            if (urlStr === 'https://test.com/list.txt') {
                return Promise.resolve(new Response('1.1.1.0/24\n# Comment\n2.2.2.0/24', {
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' }
                }));
            }
            // Fallback to real fetch
            return originalFetch(input, init);
        });

        const user = userEvent.setup();
        const urlViewName = await createTestView('view-url');

        renderComponent();

        await user.click(await screen.findByText(urlViewName));

        const urlInput = screen.getByPlaceholderText('https://example.com/networks.txt');
        await user.type(urlInput, 'https://test.com/list.txt');

        const fetchBtn = screen.getByRole('button', { name: 'Fetch' });
        await user.click(fetchBtn);

        // Find the specific textarea for this view
        const viewHeader = await screen.findByRole('heading', { name: urlViewName });
        const card = viewHeader.closest('.transition-all') as HTMLElement;
        const textArea = within(card).getAllByRole('textbox').find(el => el.tagName === 'TEXTAREA');

        await waitFor(() => {
            expect(textArea).toHaveValue('1.1.1.0/24\n2.2.2.0/24');
        });

        // Cleanup
        fetchSpy.mockRestore();
    });
});

