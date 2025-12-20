import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, ChevronRight, LayoutList, ShieldCheck, Search, Pencil, FileUp } from 'lucide-react';
import { zoneService } from '../api/zoneService';
import type { RecordWithView } from '../types/domain';
import { useDomainRecords } from '../hooks/useDomainRecords';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Flash, Input, Badge, InlineEditRow, Loading, ImportZoneModal, type ParsedRecord } from '../components';
import { cn } from '../lib/utils';
import { formatRecordContent, normalizeRecordName } from '../utils/recordUtils';

export const DomainDetails: React.FC = () => {
    const { name: domainName } = useParams<{ name: string }>();
    const { unifiedRecords, availableViews, loading, error, refetch } = useDomainRecords(domainName);

    // Edit State
    const [editingRecordKey, setEditingRecordKey] = useState<string | null>(null);



    // Record Creation State
    const [isAddingRecord, setIsAddingRecord] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRecords = (unifiedRecords || [])
        .filter(record => {
            const query = searchQuery.toLowerCase();
            return (
                record.name.toLowerCase().includes(query) ||
                record.type.toLowerCase().includes(query) ||
                record.content.toLowerCase().includes(query) ||
                record.view.toLowerCase().includes(query)
            );
        })
        .sort((a, b) => {
            // Group all SOA at top
            if (a.type === 'SOA' && b.type !== 'SOA') return -1;
            if (a.type !== 'SOA' && b.type === 'SOA') return 1;

            // If both are SOA, default view first, then alphabetical by view
            if (a.type === 'SOA' && b.type === 'SOA') {
                if (a.view === 'default' && b.view !== 'default') return -1;
                if (a.view !== 'default' && b.view === 'default') return 1;
                return a.view.localeCompare(b.view);
            }
            return 0;
        });

    const handleSaveRecord = async (original: RecordWithView, data: { name: string; type: string; ttl: number; content: string; view: string }) => {
        if (!domainName) return;
        try {
            const formattedContent = formatRecordContent(data.content, data.type);
            const isIdentityChanged = data.name !== original.name || data.type !== original.type || data.view !== original.view;

            if (isIdentityChanged) {
                // 1. Ensure target zone exists and get its ID
                const targetZoneId = await zoneService.ensureZoneExists(domainName, data.view);
                const newRrName = normalizeRecordName(data.name, domainName);

                // 2. ADD/UPDATE the new record FIRST
                await zoneService.patchZone(targetZoneId, [{
                    name: newRrName,
                    type: data.type,
                    ttl: data.ttl,
                    changetype: 'EXTEND',
                    records: [{ content: formattedContent, disabled: false }]
                }]);

                // 3. DELETE (PRUNE) the old record
                await zoneService.patchZone(original.zoneId, [{
                    name: original.name,
                    type: original.type,
                    ttl: original.ttl,
                    changetype: 'PRUNE',
                    records: [{ content: original.content }]
                }]);
            } else {
                // Pure update (TTL/Content change)
                const changetype = data.type === 'SOA' ? 'REPLACE' : 'EXTEND';
                const rrsets = [];

                if (data.type !== 'SOA') {
                    rrsets.push({
                        name: original.name,
                        type: original.type,
                        ttl: original.ttl,
                        changetype: 'PRUNE',
                        records: [{ content: original.content }]
                    });
                }

                rrsets.push({
                    name: original.name,
                    type: original.type,
                    ttl: data.ttl,
                    changetype: changetype,
                    records: [{ content: formattedContent, disabled: false }]
                });

                await zoneService.patchZone(original.zoneId, rrsets);
            }

            setEditingRecordKey(null);
            refetch();
        } catch (err: unknown) {
            alert('Failed to update record: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };


    const handleDeleteRecord = async (record: RecordWithView) => {
        try {
            await zoneService.patchZone(record.zoneId, [{
                name: record.name,
                type: record.type,
                ttl: record.ttl,
                changetype: 'PRUNE',
                records: [{ content: record.content }]
            }]);
            setEditingRecordKey(null);
            refetch();
        } catch (err: unknown) {
            alert('Failed to delete record: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    const handleAddRecord = async (data: { name: string; type: string; ttl: number; content: string; view: string }) => {
        if (!domainName) return;
        try {
            const formattedContent = formatRecordContent(data.content, data.type);
            const targetZoneId = await zoneService.ensureZoneExists(domainName, data.view);
            const rrName = normalizeRecordName(data.name, domainName);

            await zoneService.patchZone(targetZoneId, [{
                name: rrName,
                type: data.type,
                ttl: data.ttl,
                changetype: 'EXTEND',
                records: [{ content: formattedContent, disabled: false }]
            }]);

            setIsAddingRecord(false);
            refetch();
        } catch (err: unknown) {
            alert('Failed to add record: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    const handleImportRecords = async (records: ParsedRecord[], view: string) => {
        if (!domainName) return;
        try {
            const rrsetsMap: Record<string, { name: string, type: string, ttl: number, records: { content: string, disabled: boolean }[] }> = {};

            records.forEach(r => {
                const key = `${r.name}-${r.type}`;
                if (!rrsetsMap[key]) {
                    rrsetsMap[key] = {
                        name: r.name,
                        type: r.type,
                        ttl: r.ttl,
                        records: []
                    };
                }
                rrsetsMap[key].records.push({
                    content: formatRecordContent(r.content, r.type),
                    disabled: false
                });
            });

            const targetZoneId = await zoneService.ensureZoneExists(domainName, view);

            await zoneService.patchZone(targetZoneId, Object.values(rrsetsMap).map(rrset => ({
                ...rrset,
                changetype: 'EXTEND'
            })));

            refetch();
        } catch (err: unknown) {
            alert('Failed to import records: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

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
                <div className="flex items-center gap-3">
                    <Button variant="ghost" leadingIcon={FileUp} onClick={() => setIsImportModalOpen(true)} size="lg">
                        Import
                    </Button>
                    <Button variant="primary" leadingIcon={Plus} onClick={() => setIsAddingRecord(true)} size="lg" disabled={isAddingRecord}>
                        Add Record
                    </Button>
                </div>
            </div>

            <ImportZoneModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportRecords}
                availableViews={availableViews}
                domainName={domainName || ''}
            />

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
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[145px]">Type</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[110px]">TTL</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Content</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[160px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {isAddingRecord && (
                                        <InlineEditRow
                                            record={{
                                                name: '',
                                                type: 'A',
                                                ttl: 3600,
                                                content: '',
                                                view: 'default'
                                            }}
                                            availableViews={availableViews}
                                            onSave={handleAddRecord}
                                            onCancel={() => setIsAddingRecord(false)}
                                        />
                                    )}
                                    {filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                                                {unifiedRecords.length === 0 ? "No records found for this domain." : "No matching records found."}
                                            </td>
                                        </tr>
                                    ) : filteredRecords.map((rr) => {
                                        const uniqueKey = `${rr.zoneId}-${rr.name}-${rr.type}-${rr.content}`;
                                        const isEditing = editingRecordKey === uniqueKey;

                                        if (isEditing) {
                                            return (
                                                <InlineEditRow
                                                    key={uniqueKey}
                                                    record={{
                                                        name: rr.name,
                                                        type: rr.type,
                                                        ttl: rr.ttl,
                                                        content: rr.content,
                                                        view: rr.view
                                                    }}
                                                    availableViews={availableViews}
                                                    onSave={async (data) => handleSaveRecord(rr, data)}
                                                    onDelete={async () => handleDeleteRecord(rr)}
                                                    onCancel={() => setEditingRecordKey(null)}
                                                />
                                            );
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
                                                    <div className="py-0.5">{rr.content}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 text-muted-foreground hover:text-foreground"
                                                        onClick={() => setEditingRecordKey(uniqueKey)}
                                                        title="Edit Record"
                                                        data-testid="edit-record-btn"
                                                    >
                                                        <Pencil className="size-4" />
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
        </div>
    );
}
