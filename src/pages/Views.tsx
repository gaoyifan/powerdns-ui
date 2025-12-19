import React, { useEffect, useState } from 'react';
import { List, Network as NetworkIcon, ChevronDown, ChevronUp, Save, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { parseZoneId } from '../utils/zoneUtils';
import { Button, Card, Flash, Input, Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Loading, EmptyState, DeleteConfirmationModal } from '../components';
import type { Zone, Network } from '../types/api';

interface ViewWithNetworks {
    name: string;
    networks: string[];
}



export const Views: React.FC = () => {
    const [views, setViews] = useState<ViewWithNetworks[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedView, setExpandedView] = useState<string | null>(null);

    // Edit State
    const [editNetworksContent, setEditNetworksContent] = useState('');
    const [saving, setSaving] = useState(false);

    // Create View State
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newViewName, setNewViewName] = useState('');
    const [creating, setCreating] = useState(false);

    // Delete State
    const [viewToDelete, setViewToDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Zones to discover views (via _marker zones)
            const zones = await apiClient.request<Zone[]>('/servers/localhost/zones');

            const foundViews = new Set<string>(['default']);
            zones.forEach(z => {
                // Check if it's a marker zone
                if (z.name.startsWith('_marker.')) {
                    const parts = z.name.split('.');
                    // _marker.viewname.
                    if (parts.length >= 3) {
                        foundViews.add(parts[1]);
                    }
                }
                // Fallback: check zone suffix
                const { view } = parseZoneId(z.name);
                if (view) foundViews.add(view);
            });

            // 2. Fetch Networks
            const networksRes = await apiClient.request<Network[]>('/servers/localhost/networks');
            const allNetworks = Array.isArray(networksRes) ? networksRes : (networksRes as { networks: Network[] }).networks || [];

            const viewList = Array.from(foundViews).sort().map(v => ({
                name: v,
                networks: allNetworks.filter(n => (n.view || 'default') === v).map(n => n.network)
            }));

            setViews(viewList);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load views');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleExpand = (viewName: string, networks: string[]) => {
        if (expandedView === viewName) {
            setExpandedView(null);
            setEditNetworksContent('');
        } else {
            setExpandedView(viewName);
            setEditNetworksContent(networks.join('\n'));
        }
    };

    const handleSaveNetworks = async (viewName: string) => {
        setSaving(true);
        try {
            const currentNetworks = views.find(v => v.name === viewName)?.networks || [];
            const newNetworks = editNetworksContent.split('\n').map(s => s.trim()).filter(Boolean);

            // Determine additions and removals
            const toAdd = newNetworks.filter(n => !currentNetworks.includes(n));
            const toRemove = currentNetworks.filter(n => !newNetworks.includes(n));

            // Execute changes
            // Removals
            for (const net of toRemove) {
                const encoded = net.replace(/\//g, '%2F'); // Encode slash
                try {
                    await apiClient.request(`/servers/localhost/networks/${encoded}`, {
                        method: 'DELETE'
                    });
                } catch (e) {
                    console.error(`Failed to delete network ${net}`, e);
                }
            }

            // Additions
            for (const net of toAdd) {
                // v5 API: PUT /servers/localhost/networks/{ip}/{prefix} body: {view: ...}
                // OR simple PUT /servers/localhost/networks/{cidr-encoded}
                // Verification script used: PUT /networks/{encoded} { view: name }
                // Try unencoded first, then encoded
                try {
                    // Try 1: Unencoded (let browser handle slash)
                    await apiClient.request(`/servers/localhost/networks/${net}`, {
                        method: 'PUT',
                        body: JSON.stringify({ view: viewName })
                    });
                } catch (e: any) {
                    if (e.status === 404) {
                        // Try 2: Encoded slash
                        const encoded = net.replace(/\//g, '%2F');
                        try {
                            await apiClient.request(`/servers/localhost/networks/${encoded}`, {
                                method: 'PUT',
                                body: JSON.stringify({ view: viewName })
                            });
                        } catch (e2) {
                            console.error(`Failed to add network ${net} (encoded)`, e2);
                            alert(`Failed to add ${net}: ${(e2 as Error).message}`);
                        }
                    } else {
                        console.error(`Failed to add network ${net}`, e);
                        alert(`Failed to add ${net}: ${(e as Error).message}`);
                    }
                }
            }

            await fetchData();
            setExpandedView(null);

        } catch (err: unknown) {
            alert('Failed to save networks: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const handleCreateView = async () => {
        if (!newViewName) return;
        setCreating(true);
        try {
            // Create a marker zone: _marker.<viewname>
            const markerName = `_marker.${newViewName}.`;
            await apiClient.request('/servers/localhost/zones', {
                method: 'POST',
                body: JSON.stringify({
                    name: markerName,
                    kind: 'Native',
                    view: newViewName
                })
            });
            setIsCreateDialogOpen(false);
            setNewViewName('');
            fetchData();
        } catch (err: unknown) {
            alert('Failed to create view: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteView = async (viewName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (viewName === 'default') {
            alert('Cannot delete default view');
            return;
        }
        setViewToDelete(viewName);
    };

    const confirmDeleteView = async () => {
        if (!viewToDelete) return;
        setDeleting(true);
        try {
            // 1. Fetch all zones to find those in this view
            const zones = await apiClient.request<Zone[]>('/servers/localhost/zones');
            const loopView = viewToDelete; // Capture for loop

            // 2. Delete associated zones
            // Look for zones ending with ..viewName
            // Also need to handle potential canonical names if API returns them differently, but usually endsWith is safe for ..view
            const zonesToDelete = zones.filter(z => z.name.endsWith(`..${loopView}`) || z.name.endsWith(`..${loopView}.`));

            for (const zone of zonesToDelete) {
                try {
                    await apiClient.request(`/servers/localhost/zones/${zone.name}`, { method: 'DELETE' });
                } catch (e) {
                    console.error(`Failed to delete zone ${zone.name}`, e);
                }
            }

            // 3. Unmap associated networks
            // We can get networks from the view state or fetch fresh
            const viewObj = views.find(v => v.name === loopView);
            if (viewObj) {
                for (const net of viewObj.networks) {
                    try {
                        // Unmap by setting view to empty string
                        // Try unencoded first, then encoded if 404 (logic similar to creation)
                        try {
                            await apiClient.request(`/servers/localhost/networks/${net}`, {
                                method: 'PUT',
                                body: JSON.stringify({ view: '' })
                            });
                        } catch (e: any) {
                            if (e.status === 404) {
                                const encoded = net.replace(/\//g, '%2F');
                                await apiClient.request(`/servers/localhost/networks/${encoded}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ view: '' })
                                });
                            } else {
                                throw e;
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to unmap network ${net}`, e);
                    }
                }
            }

            // 4. Delete marker zone
            const markerName = `_marker.${loopView}.`;
            await apiClient.request(`/servers/localhost/zones/${markerName}`, {
                method: 'DELETE'
            });
            await fetchData();
            setViewToDelete(null);
        } catch (err: unknown) {
            console.error(err);
            alert('Failed to delete view: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Views</h1>
                    <p className="text-muted-foreground">Manage DNS views and their associated networks.</p>
                </div>
                <Button variant="primary" leadingIcon={Plus} onClick={() => setIsCreateDialogOpen(true)} size="lg">
                    Create View
                </Button>
            </div>

            {error && <Flash variant="danger">{error}</Flash>}

            <div className="grid gap-4">
                {loading && <Loading />}
                {!loading && views.map((view) => (
                    <Card key={view.name} className={`transition-all ${expandedView === view.name ? 'ring-2 ring-primary/20' : ''}`}>
                        <div
                            className="p-6 flex items-center justify-between cursor-pointer hover:bg-accent/30 transition-colors"
                            onClick={() => toggleExpand(view.name, view.networks)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="bg-primary/10 text-primary p-2 rounded-lg">
                                    <List className="size-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{view.name}</h3>
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                        <NetworkIcon className="size-3" />
                                        {view.networks.length} mapped networks
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {view.name !== 'default' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={(e) => handleDeleteView(view.name, e)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon">
                                    {expandedView === view.name ? <ChevronUp /> : <ChevronDown />}
                                </Button>
                            </div>
                        </div>

                        {expandedView === view.name && (
                            <div className="px-6 pb-6 pt-0 border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
                                <div className="mt-4">
                                    <label className="block text-sm font-medium mb-2">
                                        Mapped Networks (CIDR)
                                    </label>
                                    <textarea
                                        className="w-full min-h-[150px] p-3 rounded-lg border border-input bg-background font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={editNetworksContent}
                                        onChange={e => setEditNetworksContent(e.target.value)}
                                        placeholder="10.0.0.0/24&#10;192.168.1.0/24"
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Enter one network per line. These networks will be mapped to the <strong>{view.name}</strong> view.
                                    </p>
                                    <div className="mt-4 flex justify-end gap-2">
                                        <Button variant="ghost" onClick={() => setExpandedView(null)}>
                                            Cancel
                                        </Button>
                                        <Button variant="primary" onClick={() => handleSaveNetworks(view.name)} loading={saving}>
                                            <Save className="size-4 mr-2" />
                                            Save Changes
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                ))}

                {!loading && views.length === 0 && (
                    <EmptyState message="No views found." />
                )}
            </div>

            <Modal isOpen={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)}>
                <ModalHeader>
                    <ModalTitle>Create New View</ModalTitle>
                </ModalHeader>
                <ModalContent>
                    <Input
                        label="View Name"
                        value={newViewName}
                        onChange={e => setNewViewName(e.target.value)}
                        placeholder="e.g. internal"
                        block
                        autoFocus
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                        Creating a view will create a special marker zone <code>_marker.&lt;name&gt;</code>.
                    </p>
                </ModalContent>
                <ModalFooter>
                    <Button onClick={() => setIsCreateDialogOpen(false)} variant="ghost">Cancel</Button>
                    <Button variant="primary" disabled={creating || !newViewName} onClick={handleCreateView} loading={creating}>
                        Create View
                    </Button>
                </ModalFooter>
            </Modal>

            <DeleteConfirmationModal
                isOpen={!!viewToDelete}
                onClose={() => setViewToDelete(null)}
                onConfirm={confirmDeleteView}
                title={`Delete View "${viewToDelete}"`}
                description="Are you sure you want to delete this view? This will NOT delete the zones assigned to it, but only the view marker. Zones will revert to default view if not reassigned."
                loading={deleting}
            />
        </div>
    );
};
