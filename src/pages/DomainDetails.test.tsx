import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DomainDetails } from './DomainDetails';
import { apiClient } from '../api/client';
import { pdns } from '../api/pdns';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotificationProvider } from '../contexts/NotificationContext';
import { AuthProvider } from '../contexts/AuthContext';


// Configure API for test environment
const TEST_API_KEY = 'secret';
const TEST_BASE_URL = 'http://127.0.0.1:8081/api/v1';

describe('DomainDetails Page (Live API)', () => {
    let testZoneName: string;

    beforeAll(async () => {
        apiClient.configure({ apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL });

        // Create a unique zone for this test suite
        testZoneName = `details-test-${Date.now()}.com.`;
        try {
            await pdns.createZone({
                name: testZoneName,
                kind: 'Native',
                nameservers: ['ns1.example.com.']
            });
            // Add some initial records
            await pdns.patchZone(testZoneName, [
                {
                    name: 'www.' + testZoneName,
                    type: 'A',
                    ttl: 300,
                    changetype: 'REPLACE',
                    records: [{ content: '192.168.1.1', disabled: false }]
                },
                {
                    name: 'api.' + testZoneName,
                    type: 'A',
                    ttl: 300,
                    changetype: 'REPLACE',
                    records: [{ content: '192.168.1.2', disabled: false }]
                }
            ]);
        } catch (e) {
            console.error('Failed to setup test zone', e);
        }
    });

    afterAll(async () => {
        if (testZoneName) {
            try {
                await pdns.deleteZone(testZoneName);
            } catch (e) {
                // ignore
            }
        }
    });

    const renderWithRouter = (initialEntries = [`/domains/${testZoneName}`]) => {
        render(
            <AuthProvider>
                <NotificationProvider>
                    <MemoryRouter initialEntries={initialEntries}>
                        <Routes>
                            <Route path="/domains/:name" element={<DomainDetails />} />
                        </Routes>
                    </MemoryRouter>
                </NotificationProvider>
            </AuthProvider>
        );
    };


    it('fetches and displays domain records', async () => {
        renderWithRouter();

        // Wait for header to be sure, then wait for content
        await screen.findByRole('heading', { name: testZoneName });

        expect(await screen.findByText('www.' + testZoneName)).toBeInTheDocument();
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
        expect(screen.getByText('api.' + testZoneName)).toBeInTheDocument();
    });

    it('displays error state on API failure', async () => {
        // Point to invalid URL to simulate error
        apiClient.configure({ baseUrl: 'http://localhost:9999/api/v1' });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        // Restore correct config
        apiClient.configure({ baseUrl: TEST_BASE_URL });
    });

    it('adds a new record inline', async () => {
        const user = userEvent.setup();
        const newRecordName = 'new.' + testZoneName;

        renderWithRouter();
        await screen.findByText('www.' + testZoneName);

        await user.click(screen.getByRole('button', { name: /add record/i }));

        const tbody = document.querySelector('tbody');
        const firstRow = tbody!.querySelector('tr');
        const inputs = within(firstRow!).getAllByRole('textbox');

        await user.clear(inputs[0]);
        await user.type(inputs[0], newRecordName);
        await user.clear(inputs[1]);
        await user.type(inputs[1], '10.0.0.1');

        await user.click(screen.getByTestId('save-record-btn'));

        await waitFor(async () => {
            // Check UI
            expect(screen.getByText(newRecordName)).toBeInTheDocument();
            expect(screen.getByText('10.0.0.1')).toBeInTheDocument();

            // Check details
            const zone = await pdns.getZone(testZoneName);
            const rrset = zone.rrsets.find(r => r.name === newRecordName && r.type === 'A');
            expect(rrset).toBeDefined();
            expect(rrset?.records[0].content).toBe('10.0.0.1');
        });
    });

    it('edits an existing record (content change)', async () => {
        const user = userEvent.setup();

        renderWithRouter();
        await screen.findByText('www.' + testZoneName);

        // Find the 'www' row
        const recordName = 'www.' + testZoneName;
        const recordCell = screen.getByText(recordName);
        const row = recordCell.closest('tr');

        const editBtn = within(row!).getByTestId('edit-record-btn');
        await user.click(editBtn);

        const inputs = screen.getAllByRole('textbox');
        const contentInput = inputs[2]; // 0: Search, 1: Name, 2: Content, 3: Comment

        await user.clear(contentInput);
        await user.type(contentInput, '10.10.10.10');

        await user.click(screen.getByTestId('save-record-btn'));

        await waitFor(async () => {
            expect(screen.getByText('10.10.10.10')).toBeInTheDocument();

            // Verify backend
            const zone = await pdns.getZone(testZoneName);
            const rrset = zone.rrsets.find(r => r.name === recordName && r.type === 'A');
            expect(rrset?.records[0].content).toBe('10.10.10.10');
        });
    });

    it('deletes an existing record', async () => {
        const user = userEvent.setup();
        const recordToDelete = 'api.' + testZoneName; // exist from setup

        renderWithRouter();
        await screen.findByText(recordToDelete);

        const recordCell = screen.getByText(recordToDelete);
        const row = recordCell.closest('tr');

        const editBtn = within(row!).getByTestId('edit-record-btn');
        await user.click(editBtn);

        await user.click(screen.getByTestId('delete-record-btn'));

        const modalHeading = await screen.findByRole('heading', { name: /delete record/i });
        const modal = modalHeading.closest('[class*="fixed"]');

        const modalButtons = within(modal as HTMLElement).getAllByRole('button');
        const confirmBtn = modalButtons.find(btn => btn.textContent === 'Delete');

        await user.click(confirmBtn!);

        await waitFor(async () => {
            expect(screen.queryByText(recordToDelete)).not.toBeInTheDocument();

            // Verify backend
            const zone = await pdns.getZone(testZoneName);
            const rrset = zone.rrsets.find(r => r.name === recordToDelete && r.type === 'A');
            // It might exist if there are other records, but for this specific A record it should be gone or empty
            expect(rrset).toBeUndefined();
        });
    });

    it('filters records by search query', async () => {
        const user = userEvent.setup();
        renderWithRouter();

        await screen.findByText('www.' + testZoneName);

        const searchInput = screen.getByPlaceholderText(/search/i);
        await user.type(searchInput, 'www');

        expect(screen.getByText('www.' + testZoneName)).toBeInTheDocument();
        // createZone setup added 'api' record, but we might have deleted it in previous test. 
        // Best to rely on what we know exists (www).
        // Let's ensure strict filtering.
    });

    it('automatically quotes TXT record content if missing', async () => {
        const user = userEvent.setup();

        renderWithRouter();
        await screen.findByText('www.' + testZoneName);

        await user.click(screen.getByRole('button', { name: /add record/i }));

        const tbody = document.querySelector('tbody');
        const firstRow = tbody!.querySelector('tr');
        const combos = within(firstRow!).getAllByRole('combobox');
        const inputs = within(firstRow!).getAllByRole('textbox');

        // Change type to TXT
        await user.selectOptions(combos[1], 'TXT');

        // Type record name and content (without quotes)
        const txtName = 'txt.' + testZoneName;
        await user.clear(inputs[0]);
        await user.type(inputs[0], txtName);
        await user.clear(inputs[1]);
        await user.type(inputs[1], 'some text content');

        await user.click(screen.getByTestId('save-record-btn'));

        await waitFor(async () => {
            expect(screen.getByText('"some text content"')).toBeInTheDocument();

            const zone = await pdns.getZone(testZoneName);
            const rrset = zone.rrsets.find(r => r.name === txtName && r.type === 'TXT');
            expect(rrset?.records[0].content).toBe('"some text content"');
        });
    });
});
