import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, ChevronRight, LayoutList, ShieldCheck, Search, Pencil } from 'lucide-react';
import { apiClient } from '../api/client';
import type { RecordWithView } from '../types/domain';
import { useDomainRecords } from '../hooks/useDomainRecords';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Flash, Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Input, Select, Badge, InlineEditRow, Loading } from '../components';
import { cn } from '../lib/utils';

export const DomainDetails: React.FC = () => {
    const { name: domainName } = useParams<{ name: string }>();
    const { unifiedRecords, availableViews, loading, error, refetch } = useDomainRecords(domainName);

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

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRecords = unifiedRecords
        .filter(record => {
            // Hide non-default SOA records
            if (record.type === 'SOA' && record.view !== 'default') return false;
            return true;
        })
        .filter(record => {
            const query = searchQuery.toLowerCase();
            return (
                record.name.toLowerCase().includes(query) ||
                record.type.toLowerCase().includes(query) ||
                record.records.some(r => r.content.toLowerCase().includes(query)) ||
                record.view.toLowerCase().includes(query)
            );
        })
        .sort((a, b) => {
            // Default SOA at top
            const aIsDefaultSoa = a.type === 'SOA' && a.view === 'default';
            const bIsDefaultSoa = b.type === 'SOA' && b.view === 'default';
            if (aIsDefaultSoa && !bIsDefaultSoa) return -1;
            if (!aIsDefaultSoa && bIsDefaultSoa) return 1;
            return 0;
        });

    const handleSaveRecord = async (original: RecordWithView, data: { name: string; type: string; ttl: number; content: string; view: string }) => {
        try {
            const nameChanged = data.name !== original.name;
            const typeChanged = data.type !== original.type;
            const viewChanged = data.view !== original.view;

            if (nameChanged || typeChanged || viewChanged) {
                // Determine target zone ID
                let targetZoneId = domainName || '';
                if (!targetZoneId.endsWith('.')) targetZoneId += '.';
                if (data.view !== 'default') {
                    const baseName = targetZoneId.slice(0, -1);
                    targetZoneId = `${baseName}..${data.view}`;
                }

                // Ensure target zone exists
                let zoneExists = false;
                try {
                    await apiClient.request(`/servers/localhost/zones/${targetZoneId}`);
                    zoneExists = true;
                } catch (e) { /* ignore 404 */ }

                if (!zoneExists) {
                    await apiClient.request('/servers/localhost/zones', {
                        method: 'POST',
                        body: JSON.stringify({
                            name: targetZoneId,
                            kind: 'Native',
                            nameservers: ['ns1.localhost.'],
                            view: data.view !== 'default' ? data.view : undefined
                        })
                    });
                }

                // Format record name correctly
                let newRrName = data.name;
                if (!newRrName.endsWith('.')) newRrName += '.';

                // 1. ADD/UPDATE the new record FIRST
                await apiClient.request(`/servers/localhost/zones/${targetZoneId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        rrsets: [{
                            name: newRrName,
                            type: data.type,
                            ttl: data.ttl,
                            changetype: 'REPLACE',
                            records: [{
                                content: data.content,
                                disabled: false
                            }]
                        }]
                    })
                });

                // 2. DELETE the old record ONLY IF the add was successful
                await apiClient.request(`/servers/localhost/zones/${original.zoneId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        rrsets: [{
                            name: original.name,
                            type: original.type,
                            changetype: 'DELETE',
                            records: []
                        }]
                    })
                });
            } else {
                // Pure update (TTL/Content change)
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
            }

            setEditingRecordKey(null);
            refetch();
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
            refetch();
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
            refetch();

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
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1.5">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShieldCheck className="size-5 text-primary" />
                                Resource Records
                            </CardTitle>
                            <CardDescription>
                                Unified list of records. Click "Edit" to modify a record inline.
                            </CardDescription>
                        </div>
                        <div className="w-full sm:w-72">
                            <Input
                                placeholder="Search records..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                leadingIcon={Search}
                                block
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <Loading className="py-20" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/30 border-b border-border">
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[150px]">View</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[250px]">Name</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[120px]">Type</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[110px]">TTL</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Content</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[160px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {unifiedRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                                                No records found for this domain.
                                            </td>
                                        </tr>
                                    ) : filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                                                No matching records found.
                                            </td>
                                        </tr>
                                    ) : filteredRecords.flatMap((rr) => {
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
                                                    availableViews={availableViews}
                                                    onSave={async (data) => handleSaveRecord(rr, data)}
                                                    onDelete={async () => handleDeleteRecord(rr)}
                                                    onCancel={() => setEditingRecordKey(null)}
                                                />
                                            ];
                                        }

                                        return (
                                            <tr key={uniqueKey} className={cn(
                                                "hover:bg-accent/40 transition-colors group",
                                                rr.type === 'SOA' && "bg-primary/[0.03] dark:bg-primary/10"
                                            )}>
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
                                                    {rr.type !== 'SOA' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 text-muted-foreground hover:text-foreground"
                                                            onClick={() => setEditingRecordKey(uniqueKey)}
                                                            title="Edit Record"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                    )}
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
