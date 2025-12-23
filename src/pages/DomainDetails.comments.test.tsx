import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DomainDetails } from './DomainDetails';
import { apiClient } from '../api/client';
import { pdns } from '../api/pdns';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotificationProvider } from '../contexts/NotificationContext';
import { AuthProvider } from '../contexts/AuthContext';

const TEST_API_KEY = 'secret';
const TEST_BASE_URL = 'http://127.0.0.1:8081/api/v1';

describe('DomainDetails Comments API', () => {
    let testZoneName: string;

    beforeAll(async () => {
        apiClient.configure({ apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL });
        testZoneName = `comments-test-${Date.now()}.com.`;
        try {
            await pdns.createZone({
                name: testZoneName,
                kind: 'Native',
                nameservers: ['ns1.example.com.'],
            });
            // Initial record
            await pdns.patchZone(testZoneName, [
                {
                    name: 'init.' + testZoneName,
                    type: 'A',
                    ttl: 300,
                    changetype: 'EXTEND', // Use extend for setup
                    records: [{ content: '1.2.3.4', disabled: false }],
                },
            ]);
        } catch (e) {
            console.error('Failed to setup test zone', e);
        }
    });

    afterAll(async () => {
        if (testZoneName) await pdns.deleteZone(testZoneName).catch(() => {});
    });

    const renderWithRouter = () => {
        render(
            <AuthProvider>
                <NotificationProvider>
                    <MemoryRouter initialEntries={[`/domains/${testZoneName}`]}>
                        <Routes>
                            <Route path="/domains/:name" element={<DomainDetails />} />
                        </Routes>
                    </MemoryRouter>
                </NotificationProvider>
            </AuthProvider>,
        );
    };

    it('sends comments in payload when adding a record', async () => {
        const user = userEvent.setup();
        const patchSpy = vi.spyOn(pdns, 'patchZone');

        renderWithRouter();
        await screen.findByText('init.' + testZoneName);

        // Click Add Record
        await user.click(screen.getByRole('button', { name: /add record/i }));

        const tbody = document.querySelector('tbody');
        const firstRow = tbody!.querySelector('tr');
        const rowInputs = within(firstRow!).getAllByRole('textbox');

        // Name is the first textbox
        const nameInput = rowInputs[0];
        const newName = 'new-w-comment';
        await user.type(nameInput, newName);

        // Find inputs
        const contentInput = rowInputs.find((i) => !i.getAttribute('placeholder') && i !== nameInput);
        const commentInput = within(firstRow!).getByTestId('record-comment-input');

        if (contentInput) await user.type(contentInput, '1.1.1.1');
        await user.type(commentInput, 'My API Test Comment');

        await user.click(screen.getByTestId('save-record-btn'));

        await waitFor(() => {
            expect(patchSpy).toHaveBeenCalled();
            // We expect TWO RRSets in the patch (or one call with multiple)
            const args = patchSpy.mock.calls.find((call) => (call[1] as any[]).some((r: any) => r.name.includes(newName)));
            expect(args).toBeDefined();
            const rrsets = args![1] as any[];

            // 1. The A record
            const aRecord = rrsets.find((r) => r.name.includes(newName) && r.type === 'A');
            expect(aRecord).toBeDefined();

            // 2. The Comment record (TYPE65534)
            const commentRecord = rrsets.find((r) => r.name.includes(newName) && r.type === 'TYPE65534');
            expect(commentRecord).toBeDefined();
            expect(commentRecord.records[0].content).toMatch(/^\\# \d+ [0-9a-f]+$/); // RFC 3597 format
        });

        patchSpy.mockRestore();
    });

    it('sends comments in payload when editing a record', async () => {
        const user = userEvent.setup();
        const patchSpy = vi.spyOn(pdns, 'patchZone');

        renderWithRouter();
        await screen.findByText('init.' + testZoneName);

        // Find existing record
        const recordCell = screen.getByText('init.' + testZoneName);
        const row = recordCell.closest('tr');
        const editBtn = within(row!).getByTestId('edit-record-btn');
        await user.click(editBtn);

        // Wait for edit inputs
        const commentInput = await screen.findByTestId('record-comment-input');

        await user.type(commentInput, 'Updated Comment');

        await user.click(screen.getByTestId('save-record-btn'));

        await waitFor(() => {
            const args = patchSpy.mock.calls.find((call) => (call[1] as any[]).some((r: any) => r.name.includes('init.') && r.type === 'TYPE65534'));
            expect(args).toBeDefined();
            const rrsets = args![1] as any[];

            const commentRecord = rrsets.find((r) => r.name.includes('init.') && r.type === 'TYPE65534' && r.changetype === 'EXTEND');
            expect(commentRecord).toBeDefined();
            expect(commentRecord!.changetype).toBe('EXTEND');
        });

        patchSpy.mockRestore();
    });
});
