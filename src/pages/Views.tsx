import React, { useEffect, useState } from 'react';
import { Heading, Text, Flash, Button, FormControl, TextInput } from '@primer/react';
import { PlusIcon, TrashIcon } from '@primer/octicons-react';
import { apiClient } from '../api/client';
import type { Zone } from '../types/api';
import { parseZoneId } from '../utils/zoneUtils';

// Simple wrapper for styling
const Card = ({ children, style }: { children: React.ReactNode, style?: React.CSSProperties }) => (
    <div style={{
        backgroundColor: 'var(--overlay-bgColor-default, #1c2128)',
        border: '1px solid var(--borderColor-default)',
        borderRadius: '6px',
        padding: '16px',
        ...style
    }}>
        {children}
    </div>
);

export const Views: React.FC = () => {
    const [views, setViews] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newViewName, setNewViewName] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchViews = async () => {
        try {
            setLoading(true);
            // v5 API doesn't list views reliably, so we derive them from Zones
            const res = await apiClient.request<Zone[]>('/servers/localhost/zones');
            const foundViews = new Set<string>(['default']); // default always exists

            res.forEach(zone => {
                const { view } = parseZoneId(zone.name);
                if (view) foundViews.add(view);
            });

            setViews(Array.from(foundViews).sort());
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load views');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchViews();
    }, []);

    const handleCreateView = async () => {
        if (!newViewName) return;
        setCreating(true);
        try {
            // Create a marker zone to implicitly define the view
            const markerName = `_marker.${newViewName}.`;
            await apiClient.request('/servers/localhost/zones', {
                method: 'POST',
                body: JSON.stringify({
                    name: markerName,
                    kind: 'Native',
                    view: newViewName
                })
            });
            setNewViewName('');
            setIsDialogOpen(false);
            fetchViews();
        } catch (err: any) {
            if (err.status === 409) {
                // Already exists, just refresh
                setIsDialogOpen(false);
                fetchViews();
                return;
            }
            alert('Failed to create view: ' + err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteView = async (viewName: string) => {
        if (viewName === 'default') {
            alert('Cannot delete default view');
            return;
        }
        if (!confirm(`Are you sure you want to delete view "${viewName}"? This will NOT delete zones in it, but only the marker.`)) return;

        // We can only try to delete the marker zone if we know it?
        // Actually, we can't easily "delete a view" if it's implicit.
        // We can check if there's a marker zone and delete it.
        try {
            const markerName = `_marker.${viewName}.`;
            // Retrieve zone ID for the marker in that view
            const markerId = `${markerName}.${viewName}`; // Best guess ID for v5 variant

            await apiClient.request(`/servers/localhost/zones/${markerId}`, {
                method: 'DELETE'
            });
            fetchViews();
        } catch (err: any) {
            alert('Failed to delete view marker: ' + err.message);
        }
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <Heading>Views</Heading>
                    <Text style={{ color: 'var(--fgColor-muted)' }}>Manage DNS Views (Implicit via Zones)</Text>
                </div>
                <Button leadingVisual={PlusIcon} variant="primary" onClick={() => setIsDialogOpen(true)}>Create View</Button>
            </div>

            {error && <Flash variant="danger" style={{ marginBottom: '16px' }}>{error}</Flash>}

            {loading ? (
                <Text>Loading views...</Text>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {views.map(view => (
                        <Card key={view} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontWeight: 'bold' }}>{view}</Text>
                            {view !== 'default' && (
                                <Button
                                    variant="danger"
                                    size="small"
                                    leadingVisual={TrashIcon}
                                    onClick={() => handleDeleteView(view)}
                                    aria-label={`Delete ${view}`}
                                />
                            )}
                        </Card>
                    ))}
                </div>
            )}

            {isDialogOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{ backgroundColor: '#1c2128', padding: '24px', borderRadius: '6px', width: '400px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', border: '1px solid var(--borderColor-default)' }}>
                        <Heading style={{ fontSize: '18px', marginBottom: '16px' }}>Create New View</Heading>
                        <FormControl>
                            <FormControl.Label>View Name</FormControl.Label>
                            <TextInput
                                block
                                value={newViewName}
                                onChange={e => setNewViewName(e.target.value)}
                                placeholder="e.g. internal, external"
                                autoFocus
                            />
                        </FormControl>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                            <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button variant="primary" disabled={creating || !newViewName} onClick={handleCreateView}>
                                {creating ? 'Creating...' : 'Create'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
