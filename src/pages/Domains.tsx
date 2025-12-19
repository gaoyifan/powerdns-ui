import React, { useEffect, useState } from 'react';
import { Plus, Globe, ExternalLink, Activity, Server, Layers, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Zone, Server as ServerType, StatisticItem } from '../types/api';
import { parseZoneId } from '../utils/zoneUtils';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Flash, Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Input, Select, Badge } from '../components';

interface UnifiedZone {
    name: string;
    views: string[];
    ids: string[];
}

const StatsCard: React.FC<{
    title: string;
    value: string | number;
    description: string;
    icon: React.ElementType;
    loading?: boolean;
}> = ({ title, value, description, icon: Icon, loading }) => (
    <Card>
        <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <div className="bg-primary/10 p-2 rounded-full text-primary">
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            {loading ? (
                <div className="h-8 w-24 bg-muted animate-pulse rounded mt-2" />
            ) : (
                <div className="text-2xl font-bold">{value}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardContent>
    </Card>
);

export const Domains: React.FC = () => {
    const [unifiedZones, setUnifiedZones] = useState<UnifiedZone[]>([]);
    const [serverInfo, setServerInfo] = useState<ServerType | null>(null);
    const [stats, setStats] = useState<StatisticItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create Modal State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneType, setNewZoneType] = useState('Native');
    const [creating, setCreating] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [zonesRes, serverRes, statsRes] = await Promise.all([
                apiClient.request<Zone[]>('/servers/localhost/zones'),
                apiClient.request<ServerType>('/servers/localhost'),
                apiClient.request<StatisticItem[]>('/servers/localhost/statistics').catch(() => [] as StatisticItem[])
            ]);

            const grouped: Record<string, UnifiedZone> = {};
            zonesRes.forEach(zone => {
                const { name, view } = parseZoneId(zone.id);
                if (!grouped[name]) {
                    grouped[name] = { name, views: [], ids: [] };
                }
                grouped[name].views.push(view);
                grouped[name].ids.push(zone.id);
            });

            setUnifiedZones(Object.values(grouped));
            setServerInfo(serverRes);
            setStats(statsRes);
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
            fetchData();
        } catch (err: unknown) {
            alert('Failed to create zone: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteZone = async (ids: string[], name: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm(`Are you sure you want to delete domain "${name}"? This will delete all ${ids.length} versions of it across views.`)) return;

        try {
            await Promise.all(ids.map(id =>
                apiClient.request(`/servers/localhost/zones/${id}`, { method: 'DELETE' })
            ));
            fetchData();
        } catch (err) {
            alert('Failed to delete domain: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
                    <p className="text-muted-foreground">Manage and configure your DNS zones across different views.</p>
                </div>
                <Button variant="primary" leadingIcon={Plus} onClick={() => setIsDialogOpen(true)} size="lg">
                    Create Zone
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Domains"
                    value={unifiedZones.length}
                    description="Total managed domains"
                    icon={Globe}
                    loading={loading}
                />
                <StatsCard
                    title="Views"
                    value={unifiedZones.reduce((acc, z) => acc + z.views.length, 0)}
                    description="Total active views"
                    icon={Layers}
                    loading={loading}
                />
                <StatsCard
                    title="Server Status"
                    value={serverInfo ? 'Online' : 'Unknown'}
                    description={serverInfo ? `Version ${serverInfo.version.split(' ')[0]}` : 'Connecting...'}
                    icon={Activity}
                    loading={loading}
                />
                <StatsCard
                    title="Uptime"
                    value={stats.find(s => s.name === 'uptime')?.value || 'N/A'}
                    description="Process uptime (seconds)"
                    icon={Server}
                    loading={loading}
                />
            </div>

            {error && <Flash variant="danger">{error}</Flash>}

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Globe className="size-5 text-primary" />
                        Active Zones
                    </CardTitle>
                    <CardDescription>A list of all DNS zones currently managed by PowerDNS.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-12 flex justify-center">
                            <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" />
                        </div>
                    ) : unifiedZones.length === 0 ? (
                        <div className="py-12 text-center border-2 border-dashed border-border rounded-xl">
                            <p className="text-muted-foreground italic">No zones found. Create your first zone to get started.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {unifiedZones.map((zone) => (
                                <Link
                                    key={zone.name}
                                    to={`/domains/${encodeURIComponent(zone.name)}`}
                                    className="group flex items-center justify-between p-4 rounded-xl border border-border/60 bg-background/50 hover:bg-accent/50 hover:border-primary/30 transition-all shadow-sm cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-primary/10 text-primary p-2 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <Globe className="size-5" />
                                        </div>
                                        <div>
                                            <span className="font-bold text-lg group-hover:text-primary transition-colors block">
                                                {zone.name}
                                            </span>
                                            <div className="flex gap-2 mt-1">
                                                {zone.views.map(v => (
                                                    <Badge key={v} variant={v === 'default' ? 'secondary' : 'default'} className="px-2 py-0">
                                                        {v}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:bg-destructive/10 -mr-2"
                                            onClick={(e) => handleDeleteZone(zone.ids, zone.name, e)}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                        <div className="text-muted-foreground group-hover:text-primary transition-colors">
                                            <ExternalLink className="size-5" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Modal isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
                <ModalHeader>
                    <ModalTitle>Create New Zone</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-6">
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
                </ModalContent>
                <ModalFooter>
                    <Button onClick={() => setIsDialogOpen(false)} variant="ghost">Cancel</Button>
                    <Button variant="primary" disabled={creating || !newZoneName} onClick={handleCreateZone} loading={creating}>
                        Create Zone
                    </Button>
                </ModalFooter>
            </Modal>
        </div >
    );
};
