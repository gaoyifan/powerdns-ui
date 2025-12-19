import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Layers, ShieldCheck } from 'lucide-react';
import { apiClient } from '../api/client';
import type { Zone } from '../types/api';
import { parseZoneId } from '../utils/zoneUtils';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Flash, Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Input } from '../components';

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
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Views</h1>
                    <p className="text-muted-foreground">Manage DNS partitioning and policy-based responses.</p>
                </div>
                <Button variant="primary" leadingIcon={Plus} onClick={() => setIsDialogOpen(true)} size="lg">
                    Create View
                </Button>
            </div>

            {error && <Flash variant="danger">{error}</Flash>}

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Layers className="size-5 text-primary" />
                        Available Views
                    </CardTitle>
                    <CardDescription>Views are implicitly created and managed via zone tags.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-12 flex justify-center">
                            <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {views.map(view => (
                                <div
                                    key={view}
                                    className="group relative overflow-hidden rounded-2xl border border-border/80 bg-background/50 p-6 shadow-sm hover:border-primary/30 hover:bg-accent/40 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="bg-primary/10 text-primary p-2 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <Layers className="size-5" />
                                        </div>
                                        {view !== 'default' && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive transition-colors h-8 w-8"
                                                onClick={() => handleDeleteView(view)}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold tracking-tight">{view}</h3>
                                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                                        {view === 'default' ? 'Standard Partition' : 'Custom Partition'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Modal isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
                <ModalHeader>
                    <ModalTitle>Create New View</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-6">
                    <Input
                        label="View Name"
                        value={newViewName}
                        onChange={e => setNewViewName(e.target.value)}
                        placeholder="e.g. internal, external"
                        block
                        autoFocus
                    />
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex gap-3">
                        <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Creating a view will create a hidden marker zone. This allows you to tag zones and map networks to this partition.
                        </p>
                    </div>
                </ModalContent>
                <ModalFooter>
                    <Button onClick={() => setIsDialogOpen(false)} variant="ghost">Cancel</Button>
                    <Button variant="primary" disabled={creating || !newViewName} onClick={handleCreateView} loading={creating}>
                        Create View
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};
