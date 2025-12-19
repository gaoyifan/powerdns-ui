import React, { useEffect, useState } from 'react';
import { Heading, Text, Flash, Button, FormControl, TextInput, Select } from '@primer/react';
import { PlusIcon, TrashIcon } from '@primer/octicons-react';
import { apiClient } from '../api/client';
import type { Network, Zone } from '../types/api';
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
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
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
            // PUT /networks/:subnet { view: '...' }
            await apiClient.request(`/servers/localhost/networks/${newSubnet}`, {
                method: 'PUT',
                body: JSON.stringify({ view: selectedView || null }) // explicit null for no view? or string?
            });
            setNewSubnet('');
            setSelectedView('');
            setIsDialogOpen(false);
            fetchData();
        } catch (err: any) {
            alert('Failed to add network: ' + err.message);
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
        } catch (err: any) {
            alert('Failed to delete network mapping: ' + err.message);
        }
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <Heading>Networks</Heading>
                    <Text style={{ color: 'var(--fgColor-muted)' }}>Map Client Subnets to Views</Text>
                </div>
                <Button leadingVisual={PlusIcon} variant="primary" onClick={() => setIsDialogOpen(true)}>Add Network</Button>
            </div>

            {error && <Flash variant="danger" style={{ marginBottom: '16px' }}>{error}</Flash>}

            {loading ? (
                <Text>Loading networks...</Text>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {networks.length === 0 ? (
                        <Text style={{ fontStyle: 'italic', color: 'var(--fgColor-muted)' }}>No networks configured.</Text>
                    ) : networks.map((net, i) => (
                        <Card key={net.network + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text style={{ fontWeight: 'bold', display: 'block' }}>{net.network}</Text>
                                <Text style={{ fontSize: '12px', color: 'var(--fgColor-muted)' }}>View: {net.view || 'default'}</Text>
                            </div>
                            <Button
                                variant="danger"
                                size="small"
                                leadingVisual={TrashIcon}
                                onClick={() => handleDeleteNetwork(net.network)}
                                aria-label={`Remove ${net.network}`}
                            />
                        </Card>
                    ))}
                </div>
            )}

            {isDialogOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div style={{ backgroundColor: '#1c2128', padding: '24px', borderRadius: '6px', width: '400px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', border: '1px solid var(--borderColor-default)' }}>
                        <Heading style={{ fontSize: '18px', marginBottom: '16px' }}>Map Network</Heading>
                        <FormControl style={{ marginBottom: '16px' }}>
                            <FormControl.Label>Subnet (CIDR)</FormControl.Label>
                            <TextInput
                                block
                                value={newSubnet}
                                onChange={e => setNewSubnet(e.target.value)}
                                placeholder="e.g. 192.168.0.0/24"
                                autoFocus
                            />
                        </FormControl>

                        <FormControl>
                            <FormControl.Label>View</FormControl.Label>
                            <Select block value={selectedView} onChange={e => setSelectedView(e.target.value)}>
                                <Select.Option value="" disabled>Select a View...</Select.Option>
                                {views.map(v => <Select.Option key={v} value={v}>{v}</Select.Option>)}
                            </Select>
                        </FormControl>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                            <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button variant="primary" disabled={creating || !newSubnet || !selectedView} onClick={handleAddNetwork}>
                                {creating ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
