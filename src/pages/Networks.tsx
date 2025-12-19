import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../api/client';
import type { Network, Zone } from '../types/api';
import { parseZoneId } from '../utils/zoneUtils';
import { Button, Card, Flash, Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Input, Select } from '../components';

export const Networks: React.FC = () => {
    const [networks, setNetworks] = useState<Network[]>([]);
    const [views, setViews] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newSubnet, setNewSubnet] = useState('');
    const [selectedView, setSelectedView] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [netRes, zoneRes] = await Promise.all([
                apiClient.request<{ networks: Network[] }>('/servers/localhost/networks'),
                apiClient.request<Zone[]>('/servers/localhost/zones')
            ]);
            setNetworks(netRes.networks || []);

            const foundViews = new Set<string>(['default']);
            zoneRes.forEach(zone => {
                const { view } = parseZoneId(zone.name);
                if (view) foundViews.add(view);
            });
            setViews(Array.from(foundViews).sort());

            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddNetwork = async () => {
        if (!newSubnet) return;
        setCreating(true);
        try {
            await apiClient.request(`/servers/localhost/networks/${newSubnet}`, {
                method: 'PUT',
                body: JSON.stringify({ view: selectedView || null })
            });
            setNewSubnet('');
            setSelectedView('');
            setIsDialogOpen(false);
            fetchData();
        } catch (err: unknown) {
            alert('Failed to add network: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteNetwork = async (subnet: string) => {
        if (!confirm(`Are you sure you want to unmap subnet "${subnet}"?`)) return;
        try {
            await apiClient.request(`/servers/localhost/networks/${subnet}`, {
                method: 'DELETE'
            });
            fetchData();
        } catch (err: unknown) {
            alert('Failed to delete network mapping: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Networks</h1>
                    <p className="text-text-secondary text-sm">Map Client Subnets to Views</p>
                </div>
                <Button variant="primary" leadingIcon={Plus} onClick={() => setIsDialogOpen(true)}>
                    Add Network
                </Button>
            </div>

            {error && <Flash variant="danger" className="mb-4">{error}</Flash>}

            {loading ? (
                <p className="text-text-secondary">Loading networks...</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {networks.length === 0 ? (
                        <p className="text-text-muted italic">No networks configured.</p>
                    ) : networks.map((net, i) => (
                        <Card key={net.network + i} className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-text-primary">{net.network}</p>
                                <p className="text-xs text-text-secondary">View: {net.view || 'default'}</p>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                leadingIcon={Trash2}
                                onClick={() => handleDeleteNetwork(net.network)}
                                aria-label={`Remove ${net.network}`}
                            />
                        </Card>
                    ))}
                </div>
            )}

            <Modal isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
                <ModalHeader>
                    <ModalTitle>Map Network</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-4">
                    <Input
                        label="Subnet (CIDR)"
                        value={newSubnet}
                        onChange={e => setNewSubnet(e.target.value)}
                        placeholder="e.g. 192.168.0.0/24"
                        block
                        autoFocus
                    />

                    <Select
                        label="View"
                        value={selectedView}
                        onChange={e => setSelectedView(e.target.value)}
                        block
                    >
                        <option value="" disabled>Select a View...</option>
                        {views.map(v => <option key={v} value={v}>{v}</option>)}
                    </Select>
                </ModalContent>
                <ModalFooter>
                    <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button variant="primary" disabled={creating || !newSubnet || !selectedView} onClick={handleAddNetwork} loading={creating}>
                        {creating ? 'Saving...' : 'Save'}
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};
