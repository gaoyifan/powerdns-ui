import React, { useEffect, useState } from 'react';
import { Heading, Text, Flash, Button, FormControl, TextInput, Select, Label } from '@primer/react';
import { PlusIcon, GlobeIcon } from '@primer/octicons-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Zone } from '../types/api';
import { parseZoneId } from '../utils/zoneUtils';

interface UnifiedZone {
    name: string; // Canonical name e.g. "example.com."
    views: string[]; // List of views e.g. ["default", "internal"]
    ids: string[]; // List of actual IDs e.g. ["example.com.", "example.com..internal"]
}

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

            // Group by canonical name
            const grouped: Record<string, UnifiedZone> = {};

            res.forEach(zone => {
                const { name, view } = parseZoneId(zone.id);
                // Note: zone.name in API output is usually canonical "example.com."
                // zone.id is "example.com." or "example.com..view"
                // We use parseZoneId on ID to be safe about Views.

                if (!grouped[name]) {
                    grouped[name] = { name, views: [], ids: [] };
                }
                grouped[name].views.push(view);
                grouped[name].ids.push(zone.id);
            });

            setUnifiedZones(Object.values(grouped));
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load zones');
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
            // POST /zones
            // Body: { name: "example.com.", kind: "Native", nameservers: [] }
            // We assume creating "default" view zone first.

            let zoneId = newZoneName;
            if (!zoneId.endsWith('.')) zoneId += '.';

            await apiClient.request('/servers/localhost/zones', {
                method: 'POST',
                body: JSON.stringify({
                    name: zoneId,
                    kind: newZoneType,
                    nameservers: [] // defaults
                })
            });

            setNewZoneName('');
            setIsDialogOpen(false);
            fetchZones();
        } catch (err: any) {
            alert('Failed to create zone: ' + err.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <Heading>Domains</Heading>
                    <Text style={{ color: 'var(--fgColor-muted)' }}>Manage DNS Zones</Text>
                </div>
                <Button leadingVisual={PlusIcon} variant="primary" onClick={() => setIsDialogOpen(true)}>Create Zone</Button>
            </div>

            {error && <Flash variant="danger" style={{ marginBottom: '16px' }}>{error}</Flash>}

            {loading ? (
                <Text>Loading zones...</Text>
            ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {unifiedZones.length === 0 ? (
                        <Text style={{ fontStyle: 'italic', color: 'var(--fgColor-muted)' }}>No zones found.</Text>
                    ) : unifiedZones.map((zone) => (
                        <Card key={zone.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ color: 'var(--fgColor-muted)' }}><GlobeIcon size={24} /></div>
                                <div>
                                    <Link
                                        to={`/zones/${encodeURIComponent(zone.name)}`}
                                        style={{
                                            fontWeight: 'bold',
                                            fontSize: '16px',
                                            color: 'var(--fgColor-default)',
                                            textDecoration: 'none'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                    >
                                        {zone.name}
                                    </Link>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        {zone.views.map(v => (
                                            <Label key={v} variant={v === 'default' ? 'secondary' : 'accent'}>{v}</Label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <Button as={Link} to={`/zones/${encodeURIComponent(zone.name)}`}>Manage</Button>
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
                        <Heading style={{ fontSize: '18px', marginBottom: '16px' }}>Create New Zone</Heading>
                        <FormControl style={{ marginBottom: '16px' }}>
                            <FormControl.Label>Zone Name</FormControl.Label>
                            <TextInput
                                block
                                value={newZoneName}
                                onChange={e => setNewZoneName(e.target.value)}
                                placeholder="e.g. example.com"
                                autoFocus
                            />
                        </FormControl>

                        <FormControl>
                            <FormControl.Label>Type</FormControl.Label>
                            <Select block value={newZoneType} onChange={e => setNewZoneType(e.target.value)}>
                                <Select.Option value="Native">Native</Select.Option>
                                <Select.Option value="Master">Master</Select.Option>
                                <Select.Option value="Slave">Slave</Select.Option>
                            </Select>
                        </FormControl>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                            <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button variant="primary" disabled={creating || !newZoneName} onClick={handleCreateZone}>
                                {creating ? 'Creating...' : 'Create'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
