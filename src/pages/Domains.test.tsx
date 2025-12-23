import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Domains } from './Domains';
import { apiClient } from '../api/client';
import { pdns } from '../api/pdns';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { NotificationProvider } from '../contexts/NotificationContext';
import { AuthProvider } from '../contexts/AuthContext';


// Configure API for test environment
const TEST_API_KEY = 'secret';
const TEST_BASE_URL = 'http://127.0.0.1:8081/api/v1';

describe('Domains Page (Live API)', () => {
    let createdZones: string[] = [];

    beforeAll(() => {
        apiClient.configure({ apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL });
    });

    afterAll(async () => {
        // Cleanup all zones created during tests
        for (const zoneId of createdZones) {
            try {
                await pdns.deleteZone(zoneId);
            } catch (e) {
                // ignore
            }
        }
    });

    const createTestZone = async (prefix: string) => {
        const zoneName = `${prefix}-${Date.now()}.com.`;
        try {
            await pdns.createZone({
                name: zoneName,
                kind: 'Native',
                nameservers: ['ns1.example.com.']
            });
            createdZones.push(zoneName);
            return zoneName;
        } catch (e: any) {
            // If already exists (e.g. from failed previous run), just return it
            if (e.status === 409 || e.status === 422) return zoneName;
            throw e;
        }
    };

    const renderComponent = () => {
        return render(
            <AuthProvider>
                <NotificationProvider>
                    <BrowserRouter>
                        <Domains />
                    </BrowserRouter>
                </NotificationProvider>
            </AuthProvider>
        );
    };


    it('fetches and renders domains', async () => {
        const zoneName = await createTestZone('fetch-test');

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText(zoneName)).toBeInTheDocument();
        });
    });

    it('creates a new zone', async () => {
        const user = userEvent.setup();
        const newZoneName = `create-ui-test-${Date.now()}.com`;
        // We track it for cleanup
        createdZones.push(newZoneName + '.');

        renderComponent();

        await user.click(screen.getByTestId('create-zone-btn'));

        const input = await screen.findByTestId('zone-name-input');
        await user.type(input, newZoneName);

        await user.click(screen.getByTestId('submit-create-zone-btn'));

        await waitFor(async () => {
            // Verify it appears in the list
            expect(screen.getByText(newZoneName + '.')).toBeInTheDocument();

            // Verify it exists in the backend
            const zone = await pdns.getZone(newZoneName + '.');
            expect(zone).toBeDefined();
        });
    });

    it('deletes a zone', async () => {
        const user = userEvent.setup();
        const zoneName = await createTestZone('delete-test');

        renderComponent();

        const zoneLink = await screen.findByText(zoneName);
        const row = zoneLink.closest('[data-testid="domain-card"]');
        expect(row).toBeInTheDocument();

        // Open dropdown menu first
        const menuBtn = within(row! as HTMLElement).getByTestId('domain-menu-btn');
        await user.click(menuBtn);

        // Find delete button within the row (it's now visible in the dropdown)
        const deleteBtn = await screen.findByTestId('delete-zone-btn');
        await user.click(deleteBtn);


        const modalTitle = await screen.findByRole('heading', { name: /Delete Domain/i });
        expect(modalTitle).toBeInTheDocument();

        const confirmBtn = screen.getByRole('button', { name: 'Delete' });
        await user.click(confirmBtn);

        await waitFor(() => {
            expect(screen.queryByText(zoneName)).not.toBeInTheDocument();
        });
    });

    it('displays error state on API failure', async () => {
        // Point to invalid URL to simulate error
        apiClient.configure({ baseUrl: 'http://localhost:9999/api/v1' });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        // Restore correct config
        apiClient.configure({ baseUrl: TEST_BASE_URL });
    });
});
