import React, { useEffect, useState } from 'react';
import { List, Network as NetworkIcon, ChevronDown, ChevronUp, Save, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { pdns } from '../api/pdns';
import { cn } from '../lib/utils';
import { Button, Card, Flash, Input, Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Loading, EmptyState, DeleteConfirmationModal } from '../components';
import type { Network } from '../types/api';

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

    // URL State
    const [viewUrls, setViewUrls] = useState<Record<string, string>>({});
    const [updatingAll, setUpdatingAll] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('view_urls');
        if (saved) {
            try {
                setViewUrls(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse saved view URLs', e);
            }
        }
    }, []);

    const updateViewUrl = (viewName: string, url: string) => {
        const newUrls = { ...viewUrls, [viewName]: url };
        setViewUrls(newUrls);
        localStorage.setItem('view_urls', JSON.stringify(newUrls));
    };

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Views from dedicated endpoint
            const { views: apiViews } = await pdns.getViews();
            const foundViews = new Set<string>(['default', ...apiViews]);

            // 2. Fetch Networks
            const networksRes = await apiClient.request<Network[]>('/servers/localhost/networks');
            const allNetworks = Array.isArray(networksRes) ? networksRes : (networksRes as { networks: Network[] }).networks || [];

            const viewList = Array.from(foundViews)
                .sort((a, b) => {
                    if (a === 'default') return -1;
                    if (b === 'default') return 1;
                    return a.localeCompare(b);
                })
                .map(v => ({
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

    const applyNetworkChanges = async (viewName: string, currentNetworks: string[], newNetworks: string[]) => {
        // Determine additions and removals
        const toAdd = newNetworks.filter(n => !currentNetworks.includes(n));
        const toRemove = currentNetworks.filter(n => !newNetworks.includes(n));

        // Execute changes
        // Removals
        for (const net of toRemove) {
            try {
                await apiClient.request(`/servers/localhost/networks/${net}`, {
                    method: 'PUT',
                    body: JSON.stringify({ view: '' })
                });
            } catch (e: any) {
                console.error(`Failed to unmap network ${net}`, e);
            }
        }

        // Additions
        for (const net of toAdd) {
            try {
                await apiClient.request(`/servers/localhost/networks/${net}`, {
                    method: 'PUT',
                    body: JSON.stringify({ view: viewName })
                });
            } catch (e: any) {
                console.error(`Failed to add network ${net}`, e);
                throw new Error(`Failed to add ${net}: ${(e as Error).message}`);
            }
        }
    };

    const handleSaveNetworks = async (viewName: string) => {
        setSaving(true);
        try {
            const currentNetworks = views.find(v => v.name === viewName)?.networks || [];
            const newNetworks = editNetworksContent.split('\n').map(s => s.trim()).filter(Boolean);

            await applyNetworkChanges(viewName, currentNetworks, newNetworks);

            await fetchData();
            setExpandedView(null);

        } catch (err: unknown) {
            alert('Failed to save networks: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const fetchUrlContent = async (url: string): Promise<string[]> => {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            // simple parsing: split by newlines, trim, ignore comments (#) and empty lines
            const lines = text.split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#'))
                .filter(l => {
                    // Basic CIDR validation (very loose) or just checking if it looks like an IP
                    return l.includes('.') || l.includes(':');
                });
            return lines;
        } catch (e) {
            throw new Error(`Failed to fetch URL ${url}: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const handleFetchFromUrl = async (viewName: string) => {
        const url = viewUrls[viewName];
        if (!url) return;

        try {
            const networks = await fetchUrlContent(url);
            setEditNetworksContent(networks.join('\n'));
        } catch (e) {
            alert((e as Error).message);
        }
    };

    const handleUpdateAll = async () => {
        if (!confirm('This will fetch network lists from saved URLs for all views and overwrite their current mappings. Continue?')) {
            return;
        }
        setUpdatingAll(true);
        try {
            let successCount = 0;
            let failCount = 0;

            for (const view of views) {
                if (view.name === 'default') continue;
                const url = viewUrls[view.name];
                if (!url) continue;

                try {
                    const newNetworks = await fetchUrlContent(url);
                    const currentNetworks = view.networks;

                    // Optimization: check if identical?
                    const sortedCurrent = [...currentNetworks].sort().join(',');
                    const sortedNew = [...newNetworks].sort().join(',');
                    if (sortedCurrent !== sortedNew) {
                        await applyNetworkChanges(view.name, currentNetworks, newNetworks);
                    }
                    successCount++;
                } catch (e) {
                    console.error(`Failed to update view ${view.name}`, e);
                    failCount++;
                }
            }

            await fetchData();
            alert(`Update All Complete.\nSuccess: ${successCount}\nFailed: ${failCount}`);

        } catch (e) {
            alert('Update All Failed: ' + (e as Error).message);
        } finally {
            setUpdatingAll(false);
        }
    };

    const handleCreateView = async () => {
        if (!newViewName) return;
        setCreating(true);
        try {
            // Documented way:
            // 1. We used to create a zone variant first, but now we simplify
            // by just using the root domain `.` as initial domain (i.e. `..<view>`)

            const zoneVariantName = `..${newViewName}`;  // placeholder zone variant

            // Step 1: Create Zone (SKIPPED for simplicity)
            /*
            await pdns.createZone({
                name: zoneVariantName,
                kind: 'Native',
                nameservers: []
            });
            */

            // Step 2: Add to View
            await pdns.createView(newViewName, zoneVariantName);

            setIsCreateDialogOpen(false);
            setNewViewName('');
            await fetchData();
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
            const loopView = viewToDelete;

            // 1. Find all zones in this view to remove them from view
            const { zones: viewZones } = await pdns.getViewZones(loopView);

            // 2. Remove zones from the view AND delete the zone variants
            for (const zoneVariant of viewZones) {
                // Pass the original zone variant name (e.g. "example.org..view" or "..view")
                await pdns.deleteViewZone(loopView, zoneVariant).catch((e) => {
                    console.error(`Failed to remove zone ${zoneVariant} from view ${loopView}`, e);
                });

                // Then try to delete the actual zone variant entity (if it exists)
                await pdns.deleteZone(zoneVariant).catch((e) => {
                    console.error(`Failed to delete zone variant ${zoneVariant}`, e);
                });
            }

            // 3. Unmap associated networks
            const viewObj = views.find(v => v.name === loopView);
            if (viewObj) {
                for (const net of viewObj.networks) {
                    try {
                        await apiClient.request(`/servers/localhost/networks/${net}`, {
                            method: 'PUT',
                            body: JSON.stringify({ view: '' })
                        });
                    } catch (e: any) {
                        console.error(`Failed to unmap network ${net}`, e);
                    }
                }
            }

            // Also remove URL from local storage?
            const newUrls = { ...viewUrls };
            delete newUrls[loopView];
            setViewUrls(newUrls);
            localStorage.setItem('view_urls', JSON.stringify(newUrls));

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
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={handleUpdateAll}
                        loading={updatingAll}
                        data-testid="update-all-btn"
                        disabled={loading}
                    >
                        Update All (URLs)
                    </Button>
                    <Button variant="primary" leadingIcon={Plus} onClick={() => setIsCreateDialogOpen(true)} size="lg" data-testid="create-view-btn">
                        Create View
                    </Button>
                </div>
            </div>

            {error && <Flash variant="danger">{error}</Flash>}

            <div className="grid gap-4">
                {loading && <Loading />}
                {!loading && views.map((view) => (
                    <Card key={view.name} className={`transition-all ${expandedView === view.name ? 'ring-2 ring-primary/20' : ''}`}>
                        <div
                            className={cn(
                                "p-6 flex items-center justify-between transition-colors",
                                view.name !== 'default' && "cursor-pointer hover:bg-accent/30"
                            )}
                            onClick={() => view.name !== 'default' && toggleExpand(view.name, view.networks)}
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
                                        data-testid="delete-view-btn"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                )}
                                {view.name !== 'default' && (
                                    <Button variant="ghost" size="icon">
                                        {expandedView === view.name ? <ChevronUp /> : <ChevronDown />}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {expandedView === view.name && (
                            <div className="px-6 pb-6 pt-0 border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
                                <div className="mt-4 space-y-4">
                                    {/* URL Fetcher */}
                                    <div className="flex items-end gap-2 bg-muted/30 p-3 rounded-lg border border-border/50">
                                        <div className="flex-1">
                                            <Input
                                                label="Source URL (Auto-updates with 'Update All')"
                                                placeholder="https://example.com/networks.txt"
                                                value={viewUrls[view.name] || ''}
                                                onChange={e => updateViewUrl(view.name, e.target.value)}
                                                className="bg-background"
                                                block
                                            />
                                        </div>
                                        <Button
                                            variant="secondary"
                                            onClick={() => handleFetchFromUrl(view.name)}
                                            disabled={!viewUrls[view.name]}
                                        >
                                            Fetch
                                        </Button>
                                    </div>

                                    <div>
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
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
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
                <ModalContent className="space-y-4">
                    <Input
                        label="View Name"
                        value={newViewName}
                        onChange={e => setNewViewName(e.target.value)}
                        placeholder="e.g. internal"
                        block
                        autoFocus
                        data-testid="view-name-input"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                        Creating a view requires at least one zone. We will automatically add the root zone `.` (i.e. `..&lt;view&gt;`) to initialize the view.
                    </p>
                </ModalContent>
                <ModalFooter>
                    <Button onClick={() => setIsCreateDialogOpen(false)} variant="ghost">Cancel</Button>
                    <Button variant="primary" disabled={creating || !newViewName} onClick={handleCreateView} loading={creating} data-testid="submit-create-view-btn">
                        Create View
                    </Button>
                </ModalFooter>
            </Modal>

            <DeleteConfirmationModal
                isOpen={!!viewToDelete}
                onClose={() => setViewToDelete(null)}
                onConfirm={confirmDeleteView}
                title={`Delete View "${viewToDelete}"`}
                description="Are you sure you want to delete this view? This will delete all associated zone variants."
                loading={deleting}
            />
        </div>
    );
};
