import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, ChevronRight, LayoutList, ShieldCheck, Search, Pencil, FileUp, Eye, EyeOff } from 'lucide-react';
import { zoneService } from '../api/zoneService';
import type { RRSet } from '../types/api';
import type { RecordWithView } from '../types/domain';
import { useDomainRecords } from '../hooks/useDomainRecords';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Flash, Input, Badge, InlineEditRow, Loading, ImportZoneModal, type ParsedRecord } from '../components';
import { cn } from '../lib/utils';
import { formatRecordContent, normalizeRecordName } from '../utils/recordUtils';
import { COMMENT_RR_TYPE, encodeRFC3597, decodeRFC3597 } from '../utils/dns';

export const DomainDetails: React.FC = () => {
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

        // 1. Extract comments from TYPE65534 records
        const commentMap = new Map<string, string[]>(); // key: "name|view" -> comments

        rawRecords.forEach(r => {
            if (r.type === COMMENT_RR_TYPE) {
                const decoded = decodeRFC3597(r.content);
                if (decoded) {
                    const k = `${r.name}|${r.view}`;
                    if (!commentMap.has(k)) commentMap.set(k, []);
                    commentMap.get(k)!.push(decoded);
                }
            }
        });

        // 2. Map normal records and attach comments
        return rawRecords
            .filter(r => r.type !== COMMENT_RR_TYPE) // Hide comment records from list
            .map(r => {
                const key = `${r.name}|${r.view}`;
                return {
                    ...r,
                    comments: (commentMap.get(key) || []).map(content => ({
                        content
                    }))
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
                // 1. Handle Old Record: Remove it from old RRSet
                await zoneService.patchZone(original.zoneId, [{
                    name: original.name,
                    type: original.type,
                    ttl: original.ttl,
                    changetype: 'PRUNE',
                    records: [{ content: original.content }]
                }]);

                // 2. Handle New Record: Add to new RRSet
                const targetZoneId = await zoneService.ensureZoneExists(domainName, data.view);
                const newRrName = normalizeRecordName(data.name, domainName);

                // Filter records that match destination (excluding comments type)
                const siblingRecords = unifiedRecords.filter(r =>
                    normalizeRecordName(r.name, domainName) === newRrName &&
                    r.type === data.type &&
                    r.view === data.view
                );

                const newRecordsPayload = [
                    ...siblingRecords.map(r => ({ content: r.content, disabled: r.disabled })),
                    { content: formattedContent, disabled: false }
                ];

                const rrsetsToPatch: RRSet[] = [{
                    name: newRrName,
                    type: data.type,
                    ttl: data.ttl,
                    changetype: 'REPLACE',
                    records: newRecordsPayload
                }];

                // 3. Handle Comments (TYPE65534)
                // We should REPLACE the comment RRSet for this name
                if (data.comments.length > 0) {
                    rrsetsToPatch.push({
                        name: newRrName,
                        type: COMMENT_RR_TYPE,
                        ttl: data.ttl,
                        changetype: 'REPLACE',
                        records: data.comments.map(c => ({ content: encodeRFC3597(c), disabled: false }))
                    });
                } else {
                    // If no comments, ensure we clean up any existing ones?
                    // Only if we know they exist. But REPLACE with empty records list = delete?
                    // Or explicit DELETE.
                    // Ideally we should look if there are existing comments to delete.
                    // For simplicity in "identity changed" (new name), just don't add them.
                    // But if target name already had comments? We should probably overwrite/delete them.
                    // Let's assume we overwrite.
                    rrsetsToPatch.push({
                        name: newRrName,
                        type: COMMENT_RR_TYPE,
                        ttl: data.ttl,
                        changetype: 'REPLACE',
                        records: []
                    });
                }

                await zoneService.patchZone(targetZoneId, rrsetsToPatch);

                // If we moved, we should also move comemnts?
                // The original had comments?
                // We PRUNED the original record. Did we touch original comments?
                // Original comments belong to the NAME.
                // If there are other records left at original name (different type?), comments might still apply?
                // This is tricky. Comments are conceptually attached to the "node" (name).
                // If we move the last record from that name, we should probably move comments.
                // But here we are editing ONE record.
                // Let's handle comments only for the NEW identity.
                // If we want to be clean, we should delete comments from old name if it becomes empty?
                // Scope: Just handle saving new comments for now.

            } else {
                // Same Identity (Update TTL, Content, Comments)
                const siblingRecords = unifiedRecords.filter(r =>
                    r.name === original.name &&
                    r.type === original.type &&
                    r.view === original.view &&
                    r.content !== original.content
                );

                const newRecordsPayload = [
                    ...siblingRecords.map(r => ({ content: r.content, disabled: r.disabled })),
                    { content: formattedContent, disabled: original.disabled }
                ];

                const rrsetsToPatch: RRSet[] = [{
                    name: original.name,
                    type: original.type,
                    ttl: data.ttl,
                    changetype: 'REPLACE',
                    records: newRecordsPayload
                }];

                // Update Comments
                if (data.comments.length > 0) {
                    rrsetsToPatch.push({
                        name: original.name,
                        type: COMMENT_RR_TYPE,
                        ttl: data.ttl,
                        changetype: 'REPLACE',
                        records: data.comments.map(c => ({ content: encodeRFC3597(c), disabled: false }))
                    });
                } else {
                    // Delete comments
                    rrsetsToPatch.push({
                        name: original.name,
                        type: COMMENT_RR_TYPE,
                        ttl: data.ttl,
                        changetype: 'REPLACE',
                        records: []
                    });
                }

                await zoneService.patchZone(original.zoneId, rrsetsToPatch);
            }

            setEditingRecordKey(null);
            refetch();
        } catch (err: unknown) {
            alert('Failed to update record: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
        } catch (err: unknown) {
            alert(`Failed to ${record.disabled ? 'enable' : 'disable'} record: ` + (err instanceof Error ? err.message : 'Unknown error'));
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

    const handleAddRecord = async (data: { name: string; type: string; ttl: number; content: string; view: string; comments: string[] }) => {
        if (!domainName) return;
        try {
            const formattedContent = formatRecordContent(data.content, data.type);
            const targetZoneId = await zoneService.ensureZoneExists(domainName, data.view);
            const rrName = normalizeRecordName(data.name, domainName);

            // Find existing records to preserve them
            const siblingRecords = unifiedRecords.filter(r =>
                normalizeRecordName(r.name, domainName) === rrName &&
                r.type === data.type &&
                r.view === data.view
            );

            const newRecordsPayload = [
                ...siblingRecords.map(r => ({ content: r.content, disabled: r.disabled })),
                { content: formattedContent, disabled: false }
            ];

            const rrsetsToPatch: RRSet[] = [{
                name: rrName,
                type: data.type,
                ttl: data.ttl,
                changetype: 'REPLACE',
                records: newRecordsPayload
            }];

            if (data.comments.length > 0) {
                rrsetsToPatch.push({
                    name: rrName,
                    type: COMMENT_RR_TYPE,
                    ttl: data.ttl,
                    changetype: 'REPLACE',
                    records: data.comments.map(c => ({ content: encodeRFC3597(c), disabled: false }))
                });
            }

            await zoneService.patchZone(targetZoneId, rrsetsToPatch);

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
