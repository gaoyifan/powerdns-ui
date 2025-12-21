import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, ChevronRight, LayoutList, ShieldCheck, Search, Pencil, FileUp, Eye, EyeOff } from 'lucide-react';
import { zoneService } from '../api/zoneService';
import type { RRSet } from '../types/api';
import type { RecordWithView } from '../types/domain';
import { useDomainRecords } from '../hooks/useDomainRecords';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Flash, Input, Badge, InlineEditRow, Loading, ImportZoneModal, type ParsedRecord } from '../components';
import { useNotification } from '../contexts/NotificationContext';
import { cn } from '../lib/utils';
import { formatRecordContent, normalizeRecordName } from '../utils/recordUtils';
import { encodeMetadata, decodeMetadata, COMMENT_RR_TYPE } from '../utils/dns';

export const DomainDetails: React.FC = () => {
    const { notify } = useNotification();
    const { name: domainName } = useParams<{ name: string }>();
    const { unifiedRecords: rawRecords, availableViews, loading, error, refetch } = useDomainRecords(domainName);

    // Edit State
    const [editingRecordKey, setEditingRecordKey] = useState<string | null>(null);



    // Record Creation State
    const [isAddingRecord, setIsAddingRecord] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    const unifiedRecords = useMemo(() => {
        if (!rawRecords) return [];

        // 1. Extract metadata from TYPE65534 records
        // Map of "name|view" -> Array of { type: string, content: string, comment: string }
        const rdataMeta = new Map<string, any[]>();

        rawRecords.forEach(r => {
            if (r.type === COMMENT_RR_TYPE) {
                const data = decodeMetadata(r.content);
                if (data && typeof data === 'object') {
                    const k = `${r.name}|${r.view}`;
                    if (!rdataMeta.has(k)) rdataMeta.set(k, []);
                    rdataMeta.get(k)!.push(data);
                }
            }
        });

        // 2. Map normal records and attach specific comments
        return rawRecords
            .filter(r => r.type !== COMMENT_RR_TYPE)
            .map(r => {
                const key = `${r.name}|${r.view}`;
                const metas = rdataMeta.get(key) || [];
                // Find comment that matches this specific record's type and content
                const matchedMeta = metas.find(m => m.type === r.type && m.content === r.content);

                return {
                    ...r,
                    comments: matchedMeta?.comment ? [{ content: matchedMeta.comment }] : []
                };
            });
    }, [rawRecords]);

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

    const handleSaveRecord = async (original: RecordWithView, data: { name: string; type: string; ttl: number; content: string; view: string; comments: string[] }) => {
        if (!domainName) return;
        try {
            const formattedContent = formatRecordContent(data.content, data.type);
            const isIdentityChanged = data.name !== original.name || data.type !== original.type || data.view !== original.view;

            if (isIdentityChanged) {
                // 1. Handle Old Record: Remove it and its specific comment
                const oldOps: any[] = [{
                    name: original.name,
                    type: original.type,
                    ttl: original.ttl,
                    changetype: 'PRUNE',
                    records: [{ content: original.content }]
                }];

                if (original.comments.length > 0) {
                    oldOps.push({
                        name: original.name,
                        type: COMMENT_RR_TYPE,
                        ttl: original.ttl,
                        changetype: 'PRUNE',
                        records: [{ content: encodeMetadata({ type: original.type, content: original.content, comment: original.comments[0].content }) }]
                    });
                }
                await zoneService.patchZone(original.zoneId, oldOps);

                // 2. Handle New Record: Ensure zone exists and add record with its comment
                const targetZoneId = await zoneService.ensureZoneExists(domainName, data.view);
                const newRrName = normalizeRecordName(data.name, domainName);

                const newOps: any[] = [{
                    name: newRrName,
                    type: data.type,
                    ttl: data.ttl,
                    changetype: 'EXTEND',
                    records: [{ content: formattedContent }]
                }];

                if (data.comments.length > 0) {
                    newOps.push({
                        name: newRrName,
                        type: COMMENT_RR_TYPE,
                        ttl: data.ttl,
                        changetype: 'EXTEND',
                        records: [{ content: encodeMetadata({ type: data.type, content: formattedContent, comment: data.comments[0] }) }]
                    });
                }
                await zoneService.patchZone(targetZoneId, newOps);

            } else {
                // Same Identity (Update TTL, Content, Comments)
                const ops: any[] = [];

                // If content changed, we PRUNE old and EXTEND new
                if (data.content !== original.content) {
                    ops.push({
                        name: original.name,
                        type: original.type,
                        ttl: original.ttl,
                        changetype: 'PRUNE',
                        records: [{ content: original.content }]
                    });
                    ops.push({
                        name: data.name,
                        type: data.type,
                        ttl: data.ttl,
                        changetype: 'EXTEND',
                        records: [{ content: formattedContent }]
                    });
                } else if (data.ttl !== original.ttl) {
                    // Update TTL for all records in RRSet
                    ops.push({
                        name: original.name,
                        type: original.type,
                        ttl: data.ttl,
                        changetype: 'REPLACE',
                        records: unifiedRecords
                            .filter(r => r.name === original.name && r.type === original.type && r.view === original.view)
                            .map(r => ({ content: r.content, disabled: r.disabled }))
                    });
                }

                // Handle specific comment change
                const oldComment = original.comments[0]?.content || '';
                const newComment = data.comments[0] || '';

                if (oldComment !== newComment || data.content !== original.content) {
                    if (oldComment) {
                        ops.push({
                            name: original.name,
                            type: COMMENT_RR_TYPE,
                            ttl: original.ttl,
                            changetype: 'PRUNE',
                            records: [{ content: encodeMetadata({ type: original.type, content: original.content, comment: oldComment }) }]
                        });
                    }
                    if (newComment) {
                        ops.push({
                            name: data.name,
                            type: COMMENT_RR_TYPE,
                            ttl: data.ttl,
                            changetype: 'EXTEND',
                            records: [{ content: encodeMetadata({ type: data.type, content: formattedContent, comment: newComment }) }]
                        });
                    }
                }

                if (ops.length > 0) {
                    await zoneService.patchZone(original.zoneId, ops);
                }
            }

            setEditingRecordKey(null);
            refetch();
            notify({ type: 'success', message: 'Record updated successfully' });
        } catch (err: unknown) {
            notify({
                type: 'error',
                title: 'Update Failed',
                message: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    };


    const handleToggleDisabled = async (record: RecordWithView) => {
        try {
            // Find sibling records in the same RRSet
            const siblingRecords = unifiedRecords.filter(r =>
                r.name === record.name &&
                r.type === record.type &&
                r.view === record.view &&
                r.content !== record.content
            );

            // Construct new records payload with the toggled state
            const newRecordsPayload = [
                ...siblingRecords.map(r => ({ content: r.content, disabled: r.disabled })),
                { content: record.content, disabled: !record.disabled }
            ];

            const rrset: RRSet = {
                name: record.name,
                type: record.type,
                ttl: record.ttl,
                changetype: 'REPLACE',
                records: newRecordsPayload
            };

            await zoneService.patchZone(record.zoneId, [rrset]);
            refetch();
            notify({ type: 'success', message: `Record ${record.disabled ? 'enabled' : 'disabled'} successfully` });
        } catch (err: unknown) {
            notify({
                type: 'error',
                title: 'Operation Failed',
                message: (err instanceof Error ? err.message : 'Unknown error')
            });
        }
    };

    const handleDeleteRecord = async (record: RecordWithView) => {
        try {
            const ops: any[] = [{
                name: record.name,
                type: record.type,
                ttl: record.ttl,
                changetype: 'PRUNE',
                records: [{ content: record.content }]
            }];

            if (record.comments.length > 0) {
                ops.push({
                    name: record.name,
                    type: COMMENT_RR_TYPE,
                    ttl: record.ttl,
                    changetype: 'PRUNE',
                    records: [{ content: encodeMetadata({ type: record.type, content: record.content, comment: record.comments[0].content }) }]
                });
            }

            await zoneService.patchZone(record.zoneId, ops);
            setEditingRecordKey(null);
            refetch();
            notify({ type: 'success', message: 'Record deleted successfully' });
        } catch (err: unknown) {
            notify({
                type: 'error',
                title: 'Deletion Failed',
                message: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    };

    const handleAddRecord = async (data: { name: string; type: string; ttl: number; content: string; view: string; comments: string[] }) => {
        if (!domainName) return;
        try {
            const formattedContent = formatRecordContent(data.content, data.type);
            const targetZoneId = await zoneService.ensureZoneExists(domainName, data.view);
            const rrName = normalizeRecordName(data.name, domainName);

            const ops: any[] = [{
                name: rrName,
                type: data.type,
                ttl: data.ttl,
                changetype: 'EXTEND',
                records: [{ content: formattedContent }]
            }];

            if (data.comments.length > 0) {
                ops.push({
                    name: rrName,
                    type: COMMENT_RR_TYPE,
                    ttl: data.ttl,
                    changetype: 'EXTEND',
                    records: [{ content: encodeMetadata({ type: data.type, content: formattedContent, comment: data.comments[0] }) }]
                });
            }

            await zoneService.patchZone(targetZoneId, ops);

            setIsAddingRecord(false);
            refetch();
            notify({ type: 'success', message: 'New record added successfully' });
        } catch (err: unknown) {
            notify({
                type: 'error',
                title: 'Add Failed',
                message: err instanceof Error ? err.message : 'Unknown error'
            });
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

            setIsImportModalOpen(false);
            refetch();
            notify({
                type: 'success',
                title: 'Import Successful',
                message: `Successfully imported ${records.length} records.`
            });
        } catch (err: unknown) {
            notify({
                type: 'error',
                title: 'Import Failed',
                message: err instanceof Error ? err.message : 'Unknown error'
            });
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
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[25%]">Content</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Comment</th>
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
                                                view: 'default',
                                                comments: []
                                            }}
                                            availableViews={availableViews}
                                            onSave={handleAddRecord}
                                            onCancel={() => setIsAddingRecord(false)}
                                        />
                                    )}
                                    {filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic">
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
                                                        view: rr.view,
                                                        comments: rr.comments
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
                                                rr.type === 'SOA' && "bg-primary/[0.03] dark:bg-primary/10",
                                                rr.disabled && "opacity-60 grayscale-[0.5]"
                                            )}>
                                                <td className="px-6 py-4">
                                                    <Badge variant={rr.view === 'default' ? 'secondary' : 'default'}>{rr.view}</Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "text-sm",
                                                            rr.disabled ? "text-muted-foreground line-through" : "text-foreground font-medium"
                                                        )}>
                                                            {rr.name}
                                                        </span>
                                                        {rr.disabled && (
                                                            <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase tracking-wider bg-muted text-muted-foreground border-muted-foreground/30">
                                                                Disabled
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline" className="bg-background">{rr.type}</Badge>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground">{rr.ttl}</td>
                                                <td className="px-6 py-4 text-sm font-mono text-muted-foreground break-all">
                                                    <div className="py-0.5">{rr.content}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground break-all">
                                                    {rr.comments?.map(c => c.content).join('; ') || ''}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 text-muted-foreground hover:text-foreground"
                                                            onClick={() => handleToggleDisabled(rr)}
                                                            title={rr.disabled ? "Enable Record" : "Disable Record"}
                                                        >
                                                            {rr.disabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                                                        </Button>
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
                                                    </div>
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
