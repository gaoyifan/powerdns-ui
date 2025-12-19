import React, { useState } from 'react';
import { Plus, Globe, ExternalLink, Activity, Server, Layers, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useZones } from '../hooks/useZones';
import { formatUptime } from '../utils/formatUtils';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Flash, Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Input, Select, Badge, StatsCard, Loading, EmptyState, DeleteConfirmationModal } from '../components';





export const Domains: React.FC = () => {
    const { unifiedZones, serverInfo, stats, loading, error, refetch } = useZones();

    // Create Modal State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneType, setNewZoneType] = useState('Native');
    const [creating, setCreating] = useState(false);

    // Delete State
    const [zoneToDelete, setZoneToDelete] = useState<{ ids: string[], name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

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
            refetch();
        } catch (err: unknown) {
            alert('Failed to create zone: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteZone = async (ids: string[], name: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setZoneToDelete({ ids, name });
    };

    const confirmDeleteZone = async () => {
        if (!zoneToDelete) return;
        setDeleting(true);
        try {
            await Promise.all(zoneToDelete.ids.map(id =>
                apiClient.request(`/servers/localhost/zones/${id}`, { method: 'DELETE' })
            ));
            refetch();
            setZoneToDelete(null);
        } catch (err) {
            alert('Failed to delete domain: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setDeleting(false);
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
                    value={formatUptime(stats.find(s => s.name === 'uptime')?.value || '0')}
                    description="Process uptime"
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
                        <Loading />
                    ) : unifiedZones.length === 0 ? (
                        <EmptyState message="No zones found. Create your first zone to get started." />
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


            <DeleteConfirmationModal
                isOpen={!!zoneToDelete}
                onClose={() => setZoneToDelete(null)}
                onConfirm={confirmDeleteZone}
                title={`Delete Domain "${zoneToDelete?.name}"`}
                description={`Are you sure you want to delete domain "${zoneToDelete?.name}"? This will delete all ${zoneToDelete?.ids.length} versions of it across views. This action cannot be undone.`}
                loading={deleting}
            />
        </div >
    );
};
