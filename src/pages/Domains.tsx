import React, { useState } from 'react';
import { Plus, Globe, ExternalLink, Activity, Server, Layers, Trash2, MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { pdns } from '../api/pdns';
import { useZones } from '../hooks/useZones';
import { formatUptime } from '../utils/formatUtils';
import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    Flash,
    Modal,
    ModalHeader,
    ModalTitle,
    ModalContent,
    ModalFooter,
    Input,
    Select,
    Badge,
    StatsCard,
    Loading,
    EmptyState,
    DeleteConfirmationModal,
} from '../components';
import { useNotification } from '../contexts/NotificationContext';
import { cn } from '../lib/utils';
import type { UnifiedZone } from '../types/domain';

export const Domains: React.FC = () => {
    const { notify } = useNotification();
    const { unifiedZones, serverInfo, stats, loading, error, refetch } = useZones();

    // Create Modal State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneType, setNewZoneType] = useState('Native');
    const [creating, setCreating] = useState(false);

    // Delete State
    const [zoneToDelete, setZoneToDelete] = useState<{ ids: string[]; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);



    // Dropdown State
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    // Kind Modal State
    const [zoneForKind, setZoneForKind] = useState<UnifiedZone | null>(null);
    const [selectedKind, setSelectedKind] = useState('');
    const [savingKind, setSavingKind] = useState(false);


    const handleCreateZone = async () => {
        if (!newZoneName) return;
        setCreating(true);
        try {
            let zoneId = newZoneName;
            if (!zoneId.endsWith('.')) zoneId += '.';

            await pdns.createZone({
                name: zoneId,
                kind: newZoneType as 'Native' | 'Master' | 'Slave',
                nameservers: [],
            });

            setNewZoneName('');
            setIsDialogOpen(false);
            refetch();
            notify({
                type: 'success',
                title: 'Zone Created',
                message: `Zone ${zoneId} has been created successfully.`,
            });
        } catch (err: unknown) {
            notify({
                type: 'error',
                title: 'Creation Failed',
                message: err instanceof Error ? err.message : 'Unknown error',
            });
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
            await Promise.all(zoneToDelete.ids.map((id) => pdns.deleteZone(id)));
            refetch();
            setZoneToDelete(null);
            notify({
                type: 'success',
                title: 'Domain Deleted',
                message: `Domain ${zoneToDelete.name} and its variants have been deleted.`,
            });
        } catch (err) {
            notify({
                type: 'error',
                title: 'Deletion Failed',
                message: err instanceof Error ? err.message : 'Unknown error',
            });
        } finally {
            setDeleting(false);
        }
    };

    const handleUpdateKind = async () => {
        if (!zoneForKind) return;
        setSavingKind(true);
        try {
            // Update all versions of the zone to have the same kind
            await Promise.all(zoneForKind.ids.map((id) => pdns.updateZone(id, { kind: selectedKind as any })));

            notify({ type: 'success', title: 'Kind Updated', message: `Zone kind for ${zoneForKind.name} updated successfully.` });
            setZoneForKind(null);
            refetch();
        } catch (err: unknown) {
            notify({
                type: 'error',
                title: 'Update Failed',
                message: err instanceof Error ? err.message : 'Unknown error',
            });
        } finally {
            setSavingKind(false);
        }
    };




    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
                    <p className="text-muted-foreground">Manage and configure your DNS zones across different views.</p>
                </div>
                <Button variant="primary" leadingIcon={Plus} onClick={() => setIsDialogOpen(true)} size="lg" data-testid="create-zone-btn">
                    Create Zone
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard title="Domains" value={unifiedZones.length} description="Total managed domains" icon={Globe} loading={loading} />
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
                    description={serverInfo?.version ? `Version ${serverInfo.version.split(' ')[0]}` : 'Connecting...'}
                    icon={Activity}
                    loading={loading}
                />
                <StatsCard
                    title="Uptime"
                    value={formatUptime(stats.find((s) => s.name === 'uptime')?.value || '0')}
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
                                <div
                                    key={zone.name}
                                    className="group flex items-center justify-between p-4 rounded-xl border border-border/60 bg-background/50 hover:bg-accent/50 hover:border-primary/30 transition-all shadow-sm relative"
                                    data-testid="domain-card"
                                >
                                    <Link to={`/domains/${encodeURIComponent(zone.name)}`} className="flex items-center gap-4 flex-grow cursor-pointer">
                                        <div className="bg-primary/10 text-primary p-2 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <Globe className="size-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 text-lg font-bold group-hover:text-primary transition-colors">
                                                <span>{zone.name}</span>
                                            </div>
                                            <div className="flex gap-2 mt-1">
                                                {zone.views.map((v) => (
                                                    <Badge key={v} variant={v === 'default' ? 'secondary' : 'default'} className="px-2 py-0 text-[10px] h-5">
                                                        {v}
                                                    </Badge>
                                                ))}
                                                {zone.kinds.map((k) => (
                                                    <Badge
                                                        key={k}
                                                        variant="outline"
                                                        className="bg-muted/30 text-muted-foreground border-border/50 flex items-center gap-1 h-5 px-2 text-[10px] font-medium cursor-pointer hover:bg-accent transition-colors"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setZoneForKind(zone);
                                                            setSelectedKind(k);
                                                        }}
                                                    >
                                                        <Server className="size-3 opacity-70" />
                                                        <span className="opacity-70 capitalize">Kind</span>
                                                        <span className="opacity-40 ml-0.5 pl-1 border-l border-muted-foreground/30 uppercase font-bold">
                                                            {k}
                                                        </span>
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </Link>
                                    <div className="flex items-center gap-2 pl-4">
                                        <Link
                                            to={`/domains/${encodeURIComponent(zone.name)}`}
                                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                            title="View Details"
                                        >
                                            <ExternalLink className="size-4" />
                                        </Link>
                                        <div className="relative">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn(
                                                    'size-9 transition-all hover:bg-accent',
                                                    activeMenu === zone.name ? 'bg-accent text-foreground' : 'text-muted-foreground',
                                                )}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setActiveMenu(activeMenu === zone.name ? null : zone.name);
                                                }}
                                                data-testid="domain-menu-btn"
                                            >
                                                <MoreHorizontal className="size-5" />
                                            </Button>

                                            {activeMenu === zone.name && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                                                    <div className="absolute right-0 top-full mt-2 w-48 bg-background border border-border rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                                        <button
                                                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setZoneForKind(zone);
                                                                setSelectedKind(zone.kinds[0] || 'Native');
                                                                setActiveMenu(null);
                                                            }}
                                                        >
                                                            <Server className="size-4 text-muted-foreground" />
                                                            Set Zone Kind
                                                        </button>
                                                        <div className="h-px bg-border/60 mx-1 my-1" />
                                                        <button
                                                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left text-destructive hover:bg-destructive/10 transition-colors"
                                                            onClick={(e) => {
                                                                handleDeleteZone(zone.ids, zone.name, e);
                                                                setActiveMenu(null);
                                                            }}
                                                            data-testid="delete-zone-btn"
                                                        >
                                                            <Trash2 className="size-4" />
                                                            Delete Domain
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
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
                        onChange={(e) => setNewZoneName(e.target.value)}
                        placeholder="e.g. example.com"
                        block
                        autoFocus
                        data-testid="zone-name-input"
                    />

                    <Select
                        label="Type"
                        value={newZoneType}
                        onChange={(e) => setNewZoneType(e.target.value)}
                        block
                        options={[
                            { value: 'Native', label: 'Native' },
                            { value: 'Master', label: 'Master' },
                            { value: 'Slave', label: 'Slave' },
                        ]}
                    />
                </ModalContent>
                <ModalFooter>
                    <Button onClick={() => setIsDialogOpen(false)} variant="ghost">
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        disabled={creating || !newZoneName}
                        onClick={handleCreateZone}
                        loading={creating}
                        data-testid="submit-create-zone-btn"
                    >
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

            <Modal isOpen={!!zoneForKind} onClose={() => setZoneForKind(null)}>
                <ModalHeader>
                    <ModalTitle>Update Zone Kind</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Set the replication kind for <strong>{zoneForKind?.name}</strong>.
                    </p>
                    <Select
                        label="Zone Kind"
                        value={selectedKind}
                        onChange={(e) => setSelectedKind(e.target.value)}
                        block
                        options={[
                            { value: 'Native', label: 'Native' },
                            { value: 'Master', label: 'Master' },
                            { value: 'Slave', label: 'Slave' },
                        ]}
                    />
                </ModalContent>
                <ModalFooter>
                    <Button onClick={() => setZoneForKind(null)} variant="ghost">
                        Cancel
                    </Button>
                    <Button variant="primary" disabled={savingKind} onClick={handleUpdateKind} loading={savingKind}>
                        Update Kind
                    </Button>
                </ModalFooter>
            </Modal>

        </div>
    );
};
