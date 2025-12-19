import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, ChevronRight, LayoutList, ShieldCheck } from 'lucide-react';
import { apiClient } from '../api/client';
import { parseZoneId } from '../utils/zoneUtils';
import type { RRSet, Zone } from '../types/api';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Flash, Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Input, Select, Badge, InlineEditRow } from '../components';

interface RecordWithView extends RRSet {
    view: string;
    zoneId: string; // The specific API zone ID (e.g. example.com..testview)
}

export const DomainDetails: React.FC = () => {
    const { name: domainName } = useParams<{ name: string }>();
    const [unifiedRecords, setUnifiedRecords] = useState<RecordWithView[]>([]);
    const [availableViews, setAvailableViews] = useState<string[]>(['default']);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit State
    const [editingRecordKey, setEditingRecordKey] = useState<string | null>(null);

    // Record Creation State
    const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
    const [newRecordName, setNewRecordName] = useState('');
    const [newRecordType, setNewRecordType] = useState('A');
    const [newRecordTTL, setNewRecordTTL] = useState(3600);
    const [newRecordContent, setNewRecordContent] = useState('');
    const [selectedTargetView, setSelectedTargetView] = useState('default');
    const [creatingRecord, setCreatingRecord] = useState(false);

    const fetchAllData = async () => {
        if (!domainName) return;
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch ALL zones to discover which views this domain exists in
            // Ideally backend would support filtering, but v5 API list is simple.
            const allZones = await apiClient.request<Zone[]>('/servers/localhost/zones');

            // 2. Identify relevant zones for this domain
            const relevantZones = allZones.filter(z => {
                const parsed = parseZoneId(z.id); // Assuming z.id holds the key, or z.name?
                // parseZoneId logic: checks if name ends with ..viewname or matches domain exactly
                // We need to match the domain part.
                return parsed.name === domainName || parsed.name === domainName + '.';
            });

            // 3. Update available views for the "Add Record" dialog (plus any others discovered globally? maybe just this domain's context)
            // Actually "Add Record" might want to let you add to a NEW view? 
            // For now let's stick to adding to existing views or 'default'.
            // If the user wants to add to a view where the domain doesn't exist yet, they might need to "add domain to view" first?
            // The requirement says "remove the concept of switching Views at the zone level".
            // Implementation: We'll assume we can list all possible views from system metadata (found via _marker zones)

            // Let's find ALL system views first to populate the dropdown
            const foundViews = new Set<string>(['default']);
            allZones.forEach(z => {
                const { view } = parseZoneId(z.name);
                if (view && view !== 'default') foundViews.add(view);
            });
            setAvailableViews(Array.from(foundViews).sort());

            // 4. Fetch Details for each relevant zone to get records
            const recordPromises = relevantZones.map(async (zone) => {
                const { view } = parseZoneId(zone.id);
                try {
                    const detailedZone = await apiClient.request<{ rrsets: RRSet[] }>(`/servers/localhost/zones/${zone.id}`);
                    return (detailedZone.rrsets || []).map(rr => ({
                        ...rr,
                        view: view,
                        zoneId: zone.id
                    }));
                } catch (e) {
                    console.error(`Failed to fetch zone details for ${zone.id}`, e);
                    return [];
                }
            });

            const results = await Promise.all(recordPromises);
            const flatRecords = results.flat();

            // Sort by name, then type, then view
            flatRecords.sort((a, b) => {
                if (a.name !== b.name) return a.name.localeCompare(b.name);
                if (a.view !== b.view) return a.view.localeCompare(b.view);
                return a.type.localeCompare(b.type);
            });

            setUnifiedRecords(flatRecords);

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load records');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [domainName]);

    const handleSaveRecord = async (original: RecordWithView, data: { name: string; type: string; ttl: number; content: string; view: string }) => {
        try {
            await apiClient.request(`/servers/localhost/zones/${original.zoneId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    rrsets: [{
                        name: original.name,
                        type: original.type,
                        ttl: data.ttl,
                        changetype: 'REPLACE',
                        records: [{
                            content: data.content,
                            disabled: false
                        }]
                    }]
                })
            });
            setEditingRecordKey(null);
            fetchAllData();
        } catch (err: unknown) {
            alert('Failed to update record: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    const handleDeleteRecord = async (record: RecordWithView) => {
        try {
            await apiClient.request(`/servers/localhost/zones/${record.zoneId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    rrsets: [{
                        name: record.name,
                        type: record.type,
                        changetype: 'DELETE',
                        records: []
                    }]
                })
            });
            setEditingRecordKey(null);
            fetchAllData();
        } catch (err: unknown) {
            alert('Failed to delete record: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    const handleAddRecord = async () => {
        if (!domainName || !newRecordContent) return;
        setCreatingRecord(true);
        try {
            // Construct target Zone ID based on selected view
            // Logic: if view is default, id is domainName. If view is custom, id is domainName..view
            // Note: We need to handle trailing dots carefully.
            let targetZoneId = domainName;
            if (!targetZoneId.endsWith('.')) targetZoneId += '.';

            if (selectedTargetView !== 'default') {
                // v5 convention found in verification: domain.rstrip(.) .. view
                const baseName = targetZoneId.slice(0, -1); // remove trailing dot
                targetZoneId = `${baseName}..${selectedTargetView}`;
            }

            // Check if zone exists, if not create it (implicit view creation for domain)
            let zoneExists = false;
            try {
                await apiClient.request(`/servers/localhost/zones/${targetZoneId}`);
                zoneExists = true;
            } catch (e) {
                // Ignore 404
            }

            if (!zoneExists) {
                await apiClient.request('/servers/localhost/zones', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: targetZoneId,
                        kind: 'Native',
                        nameservers: ['ns1.localhost.'],
                        view: selectedTargetView !== 'default' ? selectedTargetView : undefined
                    })
                });
            }

            let rrName = newRecordName;
            if (rrName === '@' || rrName === '') rrName = domainName;
            else if (!rrName.endsWith(domainName) && !rrName.endsWith(domainName + '.')) {
                rrName += '.' + domainName;
            }
            if (!rrName.endsWith('.')) rrName += '.';

            await apiClient.request(`/servers/localhost/zones/${targetZoneId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    rrsets: [{
                        name: rrName,
                        type: newRecordType,
                        ttl: Number(newRecordTTL),
                        changetype: 'REPLACE',
                        records: [{
                            content: newRecordContent,
                            disabled: false
                        }]
                    }]
                })
            });

            setIsRecordDialogOpen(false);
            setNewRecordName('');
            setNewRecordContent('');
            fetchAllData();

        } catch (err: unknown) {
            alert('Failed to add record: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setCreatingRecord(false);
        }
    };

    const recordTypes = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'PTR', 'SRV', 'NAPTR'];

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link to="/domains" className="hover:text-primary transition-colors">Domains</Link>
                <ChevronRight className="size-4" />
                <span className="text-foreground font-semibold">{domainName}</span>
            </nav>

            <div className="flex justify-between items-end">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 text-primary p-3 rounded-2xl">
                        <LayoutList className="size-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{domainName}</h1>
                        <p className="text-muted-foreground text-sm">Managing records across all views</p>
                    </div>
                </div>
                <Button variant="primary" leadingIcon={Plus} onClick={() => setIsRecordDialogOpen(true)} size="lg">
                    Add Record
                </Button>
            </div>

            {error && <Flash variant="danger">{error}</Flash>}

            <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/20">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ShieldCheck className="size-5 text-primary" />
                        Resource Records
                    </CardTitle>
                    <CardDescription>
                        Unified list of records. Click "Edit" to modify a record inline.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-20 flex justify-center">
                            <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/30 border-b border-border">
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">View</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-24">TTL</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Content</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[100px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {unifiedRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                                                No records found for this domain.
                                            </td>
                                        </tr>
                                    ) : unifiedRecords.flatMap((rr) => {
                                        const uniqueKey = `${rr.zoneId}-${rr.name}-${rr.type}`;
                                        const isEditing = editingRecordKey === uniqueKey;

                                        if (isEditing) {
                                            return [
                                                <InlineEditRow
                                                    key={uniqueKey}
                                                    record={{
                                                        name: rr.name,
                                                        type: rr.type,
                                                        ttl: rr.ttl,
                                                        content: rr.records.map(r => r.content).join('\n'), // Simplified for now
                                                        view: rr.view
                                                    }}
                                                    onSave={async (data) => handleSaveRecord(rr, data)}
                                                    onDelete={async () => handleDeleteRecord(rr)}
                                                    onCancel={() => setEditingRecordKey(null)}
                                                />
                                            ];
                                        }

                                        return (
                                            <tr key={uniqueKey} className="hover:bg-accent/40 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <Badge variant={rr.view === 'default' ? 'secondary' : 'default'}>{rr.view}</Badge>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium">{rr.name}</td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline" className="bg-background">{rr.type}</Badge>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground">{rr.ttl}</td>
                                                <td className="px-6 py-4 text-sm font-mono text-muted-foreground break-all">
                                                    {rr.records.map((r, j) => (
                                                        <div key={j} className="py-0.5">{r.content}</div>
                                                    ))}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Button variant="ghost" size="sm" onClick={() => setEditingRecordKey(uniqueKey)}>
                                                        Edit
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Modal isOpen={isRecordDialogOpen} onClose={() => setIsRecordDialogOpen(false)}>
                <ModalHeader>
                    <ModalTitle>Add Record</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <Select
                            label="Target View"
                            value={selectedTargetView}
                            onChange={e => setSelectedTargetView(e.target.value)}
                            options={availableViews.map(v => ({ value: v, label: v }))}
                            block
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <Input
                            label="Name"
                            value={newRecordName}
                            onChange={e => setNewRecordName(e.target.value)}
                            placeholder="@ or sub"
                            block
                            autoFocus
                        />
                        <Select
                            label="Record Type"
                            value={newRecordType}
                            onChange={e => setNewRecordType(e.target.value)}
                            block
                            options={recordTypes.map(t => ({ value: t, label: t }))}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        <Input
                            label="TTL"
                            type="number"
                            value={newRecordTTL}
                            onChange={e => setNewRecordTTL(Number(e.target.value))}
                            block
                        />
                        <div className="col-span-2">
                            <Input
                                label="Content"
                                value={newRecordContent}
                                onChange={e => setNewRecordContent(e.target.value)}
                                placeholder="1.2.3.4"
                                block
                            />
                        </div>
                    </div>
                </ModalContent>
                <ModalFooter>
                    <Button onClick={() => setIsRecordDialogOpen(false)} variant="ghost">Cancel</Button>
                    <Button variant="primary" disabled={creatingRecord || !newRecordContent} onClick={handleAddRecord} loading={creatingRecord}>
                        Save Record
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
}
