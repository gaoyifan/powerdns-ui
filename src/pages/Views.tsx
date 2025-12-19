import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../api/client';
import type { Zone } from '../types/api';
import { parseZoneId } from '../utils/zoneUtils';
import { Button, Card, Flash, Modal, Input } from '../components';

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
            const res = await apiClient.request<Zone[]>('/servers/localhost/zones');
            const foundViews = new Set<string>(['default']);

            res.forEach(zone => {
                const { view } = parseZoneId(zone.name);
                if (view) foundViews.add(view);
            });

            setViews(Array.from(foundViews).sort());
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load views');
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
        } catch (err: unknown) {
            const error = err as { status?: number; message?: string };
            if (error.status === 409) {
                setIsDialogOpen(false);
                fetchViews();
                return;
            }
            alert('Failed to create view: ' + (error.message || 'Unknown error'));
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

        try {
            const markerName = `_marker.${viewName}.`;
            const markerId = `${markerName}.${viewName}`;

            await apiClient.request(`/servers/localhost/zones/${markerId}`, {
                method: 'DELETE'
            });
            fetchViews();
        } catch (err: unknown) {
            alert('Failed to delete view marker: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Views</h1>
                    <p className="text-text-secondary text-sm">Manage DNS Views (Implicit via Zones)</p>
                </div>
                <Button variant="primary" leadingIcon={Plus} onClick={() => setIsDialogOpen(true)}>
                    Create View
                </Button>
            </div>

            {error && <Flash variant="danger" className="mb-4">{error}</Flash>}

            {loading ? (
                <p className="text-text-secondary">Loading views...</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {views.map(view => (
                        <Card key={view} className="flex justify-between items-center">
                            <span className="font-semibold text-text-primary">{view}</span>
                            {view !== 'default' && (
                                <Button
                                    variant="danger"
                                    size="sm"
                                    leadingIcon={Trash2}
                                    onClick={() => handleDeleteView(view)}
                                    aria-label={`Delete ${view}`}
                                />
                            )}
                        </Card>
                    ))}
                </div>
            )}

            <Modal isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="Create New View">
                <div className="space-y-4">
                    <Input
                        label="View Name"
                        value={newViewName}
                        onChange={e => setNewViewName(e.target.value)}
                        placeholder="e.g. internal, external"
                        block
                        autoFocus
                    />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button variant="primary" disabled={creating || !newViewName} onClick={handleCreateView} loading={creating}>
                            {creating ? 'Creating...' : 'Create'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
