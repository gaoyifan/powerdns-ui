import React, { useEffect, useState } from 'react';
import { Plus, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Zone } from '../types/api';
import { parseZoneId } from '../utils/zoneUtils';
import { Button, Card, Flash, Modal, Input, Select, Badge } from '../components';

interface UnifiedZone {
    name: string;
    views: string[];
    ids: string[];
}

export const Zones: React.FC = () => {
    const [unifiedZones, setUnifiedZones] = useState<UnifiedZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create Modal State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneType, setNewZoneType] = useState('Native');
    const [creating, setCreating] = useState(false);

    const fetchZones = async () => {
        try {
            setLoading(true);
            const res = await apiClient.request<Zone[]>('/servers/localhost/zones');

            const grouped: Record<string, UnifiedZone> = {};
            res.forEach(zone => {
                const { name, view } = parseZoneId(zone.id);
                if (!grouped[name]) {
                    grouped[name] = { name, views: [], ids: [] };
                }
                grouped[name].views.push(view);
                grouped[name].ids.push(zone.id);
            });

            setUnifiedZones(Object.values(grouped));
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load zones');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchZones();
    }, []);

    const handleCreateZone = async () => {
        if (!newZoneName) return;
        setCreating(true);
        try {
            let zoneId = newZoneName;
            if (!zoneId.endsWith('.')) zoneId += '.';

            await apiClient.request('/servers/localhost/zones', {
                method: 'POST',
                body: JSON.stringify({
                    name: zoneId,
                    kind: newZoneType,
                    nameservers: []
                })
            });

            setNewZoneName('');
            setIsDialogOpen(false);
            fetchZones();
        } catch (err: unknown) {
            alert('Failed to create zone: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Domains</h1>
                    <p className="text-text-secondary text-sm">Manage DNS Zones</p>
                </div>
                <Button variant="primary" leadingIcon={Plus} onClick={() => setIsDialogOpen(true)}>
                    Create Zone
                </Button>
            </div>

            {error && <Flash variant="danger" className="mb-4">{error}</Flash>}

            {loading ? (
                <p className="text-text-secondary">Loading zones...</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {unifiedZones.length === 0 ? (
                        <p className="text-text-muted italic">No zones found.</p>
                    ) : unifiedZones.map((zone) => (
                        <Card key={zone.name} className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <Globe className="w-6 h-6 text-text-muted" />
                                <div>
                                    <Link
                                        to={`/zones/${encodeURIComponent(zone.name)}`}
                                        className="font-semibold text-base text-text-primary hover:text-primary hover:underline transition-colors"
                                    >
                                        {zone.name}
                                    </Link>
                                    <div className="flex gap-2 mt-1">
                                        {zone.views.map(v => (
                                            <Badge key={v} variant={v === 'default' ? 'secondary' : 'primary'}>
                                                {v}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <Button as={Link} to={`/zones/${encodeURIComponent(zone.name)}`}>
                                Manage
                            </Button>
                        </Card>
                    ))}
                </div>
            )}

            <Modal isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="Create New Zone">
                <div className="space-y-4">
                    <Input
                        label="Zone Name"
                        value={newZoneName}
                        onChange={e => setNewZoneName(e.target.value)}
                        placeholder="e.g. example.com"
                        block
                        autoFocus
                    />

                    <Select
                        label="Type"
                        value={newZoneType}
                        onChange={e => setNewZoneType(e.target.value)}
                        block
                        options={[
                            { value: 'Native', label: 'Native' },
                            { value: 'Master', label: 'Master' },
                            { value: 'Slave', label: 'Slave' },
                        ]}
                    />

                    <div className="flex justify-end gap-2 pt-4">
                        <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button variant="primary" disabled={creating || !newZoneName} onClick={handleCreateZone} loading={creating}>
                            {creating ? 'Creating...' : 'Create'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
