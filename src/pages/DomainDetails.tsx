import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    Plus,
    ChevronRight,
    LayoutList,
    ShieldCheck,
    Search,
    Pencil,
    FileUp,
    Eye,
    EyeOff,
    Trash2,
    CheckSquare,
    Square,
    CopyPlus,
    Copy,
    Check,
    X,
} from 'lucide-react';
import { zoneService } from '../api/zoneService';
import type { RecordWithView } from '../types/domain';
import { useDomainRecords } from '../hooks/useDomainRecords';
import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    Flash,
    Input,
    Badge,
    InlineEditRow,
    Loading,
    ImportZoneModal,
    type ParsedRecord,
} from '../components';
import { useNotification } from '../contexts/NotificationContext';
import { cn } from '../lib/utils';
import { formatRecordContent, normalizeRecordName } from '../utils/recordUtils';
import { encodeMetadata, decodeMetadata, COMMENT_RR_TYPE } from '../utils/dns';

const CopyButton = ({ text, className }: { text: string; className?: string }) => {
    const [copied, setCopied] = useState(false);
    const { notify } = useNotification();

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        notify({ type: 'success', message: 'Copied to clipboard' });
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className={cn(
                'p-1 rounded-md hover:bg-muted transition-all duration-200',
                copied ? 'text-green-600 bg-green-50' : 'text-muted-foreground hover:text-foreground',
                className,
            )}
            title="Copy to clipboard"
        >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
    );
};

export const DomainDetails: React.FC = () => {
    const { notify, confirm } = useNotification();
    const { name: domainName } = useParams<{ name: string }>();
    const { unifiedRecords: rawRecords, availableViews, loading, error, refetch } = useDomainRecords(domainName);

    // Edit State
    const [editingRecordKey, setEditingRecordKey] = useState<string | null>(null);

    // Record Creation State
    const [addingRecordData, setAddingRecordData] = useState<{
        name: string;
        type: string;
        ttl: number;
        content: string;
        view: string;
        comments: any[];
    } | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Selection State
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);

    const getRecordKey = (rr: RecordWithView) => `${rr.zoneId}-${rr.name}-${rr.type}-${rr.content}`;

    const unifiedRecords = useMemo(() => {
        if (!rawRecords) return [];

        // 1. Extract metadata from TYPE65534 records
        // Map of "name|view" -> Array of { type: string, content: string, comment: string }
        const rdataMeta = new Map<string, any[]>();

        rawRecords.forEach((r) => {
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
            .filter((r) => r.type !== COMMENT_RR_TYPE)
            .map((r) => {
                const key = `${r.name}|${r.view}`;
                const metas = rdataMeta.get(key) || [];
                // Find comment that matches this specific record's type and content
                const matchedMeta = metas.find((m) => m.type === r.type && m.content === r.content);

                return {
                    ...r,
                    comments: matchedMeta?.comment ? [{ content: matchedMeta.comment }] : [],
                };
            });
    }, [rawRecords]);

    const filteredRecords = (unifiedRecords || [])
        .filter((record) => {
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

    const handleSaveRecord = async (
        original: RecordWithView,
        data: { name: string; type: string; ttl: number; content: string; view: string; comments: string[] },
    ) => {
        if (!domainName) return;
        try {
            const formattedContent = formatRecordContent(data.content, data.type);
            const isIdentityChanged = data.name !== original.name || data.type !== original.type || data.view !== original.view;

            if (isIdentityChanged) {
                // 1. Handle Old Record: Remove it and its specific comment
                const oldOps: any[] = [
                    {
                        name: original.name,
                        type: original.type,
                        ttl: original.ttl,
                        changetype: original.type === 'SOA' ? 'DELETE' : 'PRUNE',
                        records: original.type === 'SOA' ? [] : [{ content: original.content }],
                    },
                ];

                if (original.comments.length > 0) {
                    oldOps.push({
                        name: original.name,
                        type: COMMENT_RR_TYPE,
                        ttl: original.ttl,
                        changetype: 'PRUNE',
                        records: [{ content: encodeMetadata({ type: original.type, content: original.content, comment: original.comments[0].content }) }],
                    });
                }
                await zoneService.patchZone(original.zoneId, oldOps);

                // 2. Handle New Record: Ensure zone exists and add record with its comment
                const targetZoneId = await zoneService.ensureZoneExists(domainName, data.view);
                const newRrName = normalizeRecordName(data.name, domainName);

                const newOps: any[] = [
                    {
                        name: newRrName,
                        type: data.type,
                        ttl: data.ttl,
                        changetype: data.type === 'SOA' ? 'REPLACE' : 'EXTEND',
                        records: [{ content: formattedContent }],
                    },
                ];

                if (data.comments.length > 0) {
                    newOps.push({
                        name: newRrName,
                        type: COMMENT_RR_TYPE,
                        ttl: data.ttl,
                        changetype: 'EXTEND',
                        records: [{ content: encodeMetadata({ type: data.type, content: formattedContent, comment: data.comments[0] }) }],
                    });
                }
                await zoneService.patchZone(targetZoneId, newOps);
            } else {
                // Same Identity (Update TTL, Content, Comments)
                const ops: any[] = [];

                // If content changed, we PRUNE old and EXTEND new
                if (data.type === 'SOA') {
                    // For SOA, always replace the entire RRSet to avoid duplicates and handle stale serials
                    ops.push({
                        name: data.name,
                        type: data.type,
                        ttl: data.ttl,
                        changetype: 'REPLACE',
                        records: [{ content: formattedContent }],
                    });
                } else if (data.content !== original.content) {
                    ops.push({
                        name: original.name,
                        type: original.type,
                        ttl: original.ttl,
                        changetype: 'PRUNE',
                        records: [{ content: original.content }],
                    });
                    ops.push({
                        name: data.name,
                        type: data.type,
                        ttl: data.ttl,
                        changetype: 'EXTEND',
                        records: [{ content: formattedContent }],
                    });
                } else if (data.ttl !== original.ttl) {
                    // Update TTL for all records in RRSet
                    ops.push({
                        name: original.name,
                        type: original.type,
                        ttl: data.ttl,
                        changetype: 'REPLACE',
                        records: unifiedRecords
                            .filter((r) => r.name === original.name && r.type === original.type && r.view === original.view)
                            .map((r) => ({ content: r.content, disabled: r.disabled })),
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
                            records: [{ content: encodeMetadata({ type: original.type, content: original.content, comment: oldComment }) }],
                        });
                    }
                    if (newComment) {
                        ops.push({
                            name: data.name,
                            type: COMMENT_RR_TYPE,
                            ttl: data.ttl,
                            changetype: 'EXTEND',
                            records: [{ content: encodeMetadata({ type: data.type, content: formattedContent, comment: newComment }) }],
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
                message: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    };

    const getToggleDisabledOps = (recordsToToggle: RecordWithView[], targetDisabled: boolean) => {
        const opsByZone = new Map<string, any[]>();

        // Group records by RRSet (zoneId|name|type|view)
        const affectedRRSets = new Map<string, { zoneId: string; name: string; type: string; view: string; ttl: number }>();
        recordsToToggle.forEach((rr) => {
            const rrsetKey = `${rr.zoneId}|${rr.name}|${rr.type}|${rr.view}`;
            if (!affectedRRSets.has(rrsetKey)) {
                affectedRRSets.set(rrsetKey, { zoneId: rr.zoneId, name: rr.name, type: rr.type, view: rr.view, ttl: rr.ttl });
            }
        });

        const toggleKeys = new Set(recordsToToggle.map(getRecordKey));

        for (const [_, info] of affectedRRSets.entries()) {
            if (!opsByZone.has(info.zoneId)) opsByZone.set(info.zoneId, []);
            const ops = opsByZone.get(info.zoneId)!;

            // Find ALL records for this RRSet
            const allRrsetRecords = (unifiedRecords || []).filter(
                (r) => r.name === info.name && r.type === info.type && r.view === info.view && r.zoneId === info.zoneId,
            );

            // Construct new records payload
            const newRecordsPayload = allRrsetRecords.map((r) => ({
                content: r.content,
                disabled: toggleKeys.has(getRecordKey(r)) ? targetDisabled : r.disabled,
            }));

            ops.push({
                name: info.name,
                type: info.type,
                ttl: info.ttl,
                changetype: 'REPLACE',
                records: newRecordsPayload,
            });
        }
        return opsByZone;
    };

    const handleToggleDisabled = async (record: RecordWithView) => {
        try {
            const targetDisabled = !record.disabled;
            const opsByZone = getToggleDisabledOps([record], targetDisabled);
            await Promise.all(Array.from(opsByZone.entries()).map(([zoneId, ops]) => zoneService.patchZone(zoneId, ops)));
            refetch();
            notify({ type: 'success', message: `Record ${targetDisabled ? 'disabled' : 'enabled'} successfully` });
        } catch (err: unknown) {
            notify({ type: 'error', title: 'Operation Failed', message: err instanceof Error ? err.message : 'Unknown error' });
        }
    };

    // --- Helper Functions for Operations ---

    const getDeleteOps = (recordsToDelete: RecordWithView[]) => {
        const opsByZone = new Map<string, any[]>();

        // Group records by RRSet (zoneId|name|type|view)
        const affectedRRSets = new Map<string, { zoneId: string; name: string; type: string; view: string; ttl: number }>();
        recordsToDelete.forEach((rr) => {
            const rrsetKey = `${rr.zoneId}|${rr.name}|${rr.type}|${rr.view}`;
            if (!affectedRRSets.has(rrsetKey)) {
                affectedRRSets.set(rrsetKey, { zoneId: rr.zoneId, name: rr.name, type: rr.type, view: rr.view, ttl: rr.ttl });
            }
        });

        const deleteKeys = new Set(recordsToDelete.map(getRecordKey));

        for (const [_, info] of affectedRRSets.entries()) {
            if (!opsByZone.has(info.zoneId)) opsByZone.set(info.zoneId, []);
            const ops = opsByZone.get(info.zoneId)!;

            // Find ALL records for this RRSet
            const allRrsetRecords = (unifiedRecords || []).filter(
                (r) => r.name === info.name && r.type === info.type && r.view === info.view && r.zoneId === info.zoneId,
            );

            // Records to KEEP (not in the set we are deleting)
            const keepRecords = allRrsetRecords.filter((r) => !deleteKeys.has(getRecordKey(r)));

            if (keepRecords.length === 0 || info.type === 'SOA') {
                ops.push({ name: info.name, type: info.type, changetype: 'DELETE' });
            } else {
                ops.push({
                    name: info.name,
                    type: info.type,
                    ttl: info.ttl,
                    changetype: 'REPLACE',
                    records: keepRecords.map((r) => ({ content: r.content, disabled: r.disabled })),
                });
            }

            // Comments handling
            allRrsetRecords
                .filter((r) => deleteKeys.has(getRecordKey(r)))
                .forEach((rr) => {
                    if (rr.comments.length > 0) {
                        ops.push({
                            name: rr.name,
                            type: COMMENT_RR_TYPE,
                            ttl: rr.ttl,
                            changetype: 'PRUNE',
                            records: [{ content: encodeMetadata({ type: rr.type, content: rr.content, comment: rr.comments[0].content }) }],
                        });
                    }
                });
        }
        return opsByZone;
    };

    const handleDeleteRecord = async (record: RecordWithView) => {
        try {
            const opsByZone = getDeleteOps([record]);
            await Promise.all(Array.from(opsByZone.entries()).map(([zoneId, ops]) => zoneService.patchZone(zoneId, ops)));
            setEditingRecordKey(null);
            refetch();
            notify({ type: 'success', message: 'Record deleted successfully' });
        } catch (err: unknown) {
            notify({ type: 'error', title: 'Deletion Failed', message: err instanceof Error ? err.message : 'Unknown error' });
        }
    };

    const handleBulkDelete = async () => {
        const confirmed = await confirm({
            title: 'Bulk Delete Records',
            message: `Are you sure you want to delete ${selectedKeys.size} selected records? This action cannot be undone.`,
            confirmText: 'Delete All',
            cancelText: 'Cancel',
        });
        if (!confirmed) return;

        try {
            const selectedRecords = filteredRecords.filter((rr) => selectedKeys.has(getRecordKey(rr)));
            const opsByZone = getDeleteOps(selectedRecords);
            await Promise.all(Array.from(opsByZone.entries()).map(([zoneId, ops]) => zoneService.patchZone(zoneId, ops)));
            setSelectedKeys(new Set());
            refetch();
            notify({ type: 'success', message: 'Selected records deleted successfully' });
        } catch (err: unknown) {
            notify({ type: 'error', title: 'Bulk Deletion Failed', message: err instanceof Error ? err.message : 'Unknown error' });
        }
    };

    const handleBulkToggleDisabled = async (disabled: boolean) => {
        const confirmed = await confirm({
            title: disabled ? 'Bulk Disable Records' : 'Bulk Enable Records',
            message: `Are you sure you want to ${disabled ? 'disable' : 'enable'} ${selectedKeys.size} selected records?`,
            confirmText: disabled ? 'Disable All' : 'Enable All',
            cancelText: 'Cancel',
        });
        if (!confirmed) return;

        try {
            const selectedRecords = filteredRecords.filter((rr) => selectedKeys.has(getRecordKey(rr)));
            const opsByZone = getToggleDisabledOps(selectedRecords, disabled);
            await Promise.all(Array.from(opsByZone.entries()).map(([zoneId, ops]) => zoneService.patchZone(zoneId, ops)));

            setSelectedKeys(new Set());
            refetch();
            notify({ type: 'success', message: `Selected records ${disabled ? 'disabled' : 'enabled'} successfully` });
        } catch (err: unknown) {
            notify({ type: 'error', title: 'Bulk Update Failed', message: err instanceof Error ? err.message : 'Unknown error' });
        }
    };

    const toggleSelectAll = () => {
        if (selectedKeys.size === filteredRecords.length && filteredRecords.length > 0) {
            setSelectedKeys(new Set());
        } else {
            setSelectedKeys(new Set(filteredRecords.map(getRecordKey)));
        }
    };

    const toggleSelectRecord = (key: string, isShift: boolean = false) => {
        const newSelected = new Set(selectedKeys);
        if (isShift && lastSelectedKey) {
            const keys = filteredRecords.map(getRecordKey);
            const start = keys.indexOf(lastSelectedKey);
            const end = keys.indexOf(key);
            if (start !== -1 && end !== -1) {
                const [min, max] = [Math.min(start, end), Math.max(start, end)];
                const rangeKeys = keys.slice(min, max + 1);
                const shouldSelect = !selectedKeys.has(key);
                rangeKeys.forEach((k) => {
                    if (shouldSelect) newSelected.add(k);
                    else newSelected.delete(k);
                });
            }
        } else {
            if (newSelected.has(key)) {
                newSelected.delete(key);
            } else {
                newSelected.add(key);
            }
        }
        setSelectedKeys(newSelected);
        setLastSelectedKey(key);
    };

    const handleDuplicateRecord = (record: RecordWithView) => {
        setAddingRecordData({
            name: record.name,
            type: record.type,
            ttl: record.ttl,
            content: '', // Clear content as requested
            view: record.view,
            comments: record.comments.map((c) => c.content),
        });
        // Scroll to top or just let the new row appear
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleAddRecord = async (data: { name: string; type: string; ttl: number; content: string; view: string; comments: string[] }) => {
        if (!domainName) return;
        try {
            const formattedContent = formatRecordContent(data.content, data.type);
            const targetZoneId = await zoneService.ensureZoneExists(domainName, data.view);
            const rrName = normalizeRecordName(data.name, domainName);

            const ops: any[] = [
                {
                    name: rrName,
                    type: data.type,
                    ttl: data.ttl,
                    changetype: data.type === 'SOA' ? 'REPLACE' : 'EXTEND',
                    records: [{ content: formattedContent }],
                },
            ];

            if (data.comments.length > 0) {
                ops.push({
                    name: rrName,
                    type: COMMENT_RR_TYPE,
                    ttl: data.ttl,
                    changetype: 'EXTEND',
                    records: [{ content: encodeMetadata({ type: data.type, content: formattedContent, comment: data.comments[0] }) }],
                });
            }

            await zoneService.patchZone(targetZoneId, ops);
            setAddingRecordData(null); // Clear addingRecordData after successful add
            refetch();
            notify({ type: 'success', message: 'New record added successfully' });
        } catch (err: unknown) {
            notify({
                type: 'error',
                title: 'Add Failed',
                message: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    };

    const handleImportRecords = async (records: ParsedRecord[], view: string) => {
        if (!domainName) return;
        try {
            const recordsToImport = records;

            if (recordsToImport.length === 0) {
                notify({
                    type: 'info',
                    title: 'No Changes',
                    message: 'No new records found to import.',
                });
                setIsImportModalOpen(false);
                return;
            }

            const targetZoneId = await zoneService.ensureZoneExists(domainName, view);

            // PowerDNS requires exactly one record for EXTEND/PRUNE operations
            const ops = recordsToImport.map((r) => ({
                name: r.name,
                type: r.type,
                ttl: r.ttl,
                changetype: 'EXTEND' as const,
                records: [
                    {
                        content: formatRecordContent(r.content, r.type),
                        disabled: false,
                    },
                ],
            }));

            await zoneService.patchZone(targetZoneId, ops);

            setIsImportModalOpen(false);
            refetch();
            notify({
                type: 'success',
                title: 'Import Successful',
                message: `Successfully imported ${recordsToImport.length} records.`,
            });
        } catch (err: unknown) {
            notify({
                type: 'error',
                title: 'Import Failed',
                message: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link to="/domains" className="hover:text-primary transition-colors">
                    Domains
                </Link>
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
                    <Button
                        variant="primary"
                        leadingIcon={Plus}
                        onClick={() =>
                            setAddingRecordData({
                                name: '',
                                type: 'A',
                                ttl: 3600,
                                content: '',
                                view: 'default',
                                comments: [],
                            })
                        }
                        size="lg"
                        disabled={!!addingRecordData}
                    >
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
                            <CardDescription>Unified list of records. Click "Edit" to modify a record inline.</CardDescription>
                        </div>
                        <div className="flex flex-1 items-center justify-end min-w-0">
                            {selectedKeys.size > 0 ? (
                                <div className="flex items-center gap-1.5 shrink-0 animate-in fade-in slide-in-from-right-4 duration-200">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-9 px-3 text-xs uppercase tracking-wider font-bold bg-primary text-primary-foreground hover:bg-primary/90 border-none group/clear"
                                        onClick={() => setSelectedKeys(new Set())}
                                        data-testid="selection-count-badge"
                                        title="Clear selection and show search"
                                    >
                                        {selectedKeys.size} Selected
                                        <X className="size-3.5 ml-1 opacity-60 group-hover/clear:opacity-100 transition-opacity" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        leadingIcon={Trash2}
                                        className="text-destructive hover:bg-destructive/10 h-9"
                                        onClick={handleBulkDelete}
                                        data-testid="bulk-delete-btn"
                                    >
                                        Delete
                                    </Button>
                                    {Array.from(selectedKeys).some((key) => {
                                        const rr = filteredRecords.find((r) => getRecordKey(r) === key);
                                        return rr && !rr.disabled;
                                    }) && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                leadingIcon={EyeOff}
                                                className="text-muted-foreground hover:text-foreground h-9"
                                                onClick={() => handleBulkToggleDisabled(true)}
                                                data-testid="bulk-disable-btn"
                                            >
                                                Disable
                                            </Button>
                                        )}
                                    {Array.from(selectedKeys).some((key) => {
                                        const rr = filteredRecords.find((r) => getRecordKey(r) === key);
                                        return rr && rr.disabled;
                                    }) && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                leadingIcon={Eye}
                                                className="text-muted-foreground hover:text-foreground h-9"
                                                onClick={() => handleBulkToggleDisabled(false)}
                                                data-testid="bulk-enable-btn"
                                            >
                                                Enable
                                            </Button>
                                        )}
                                </div>
                            ) : (
                                <div className="w-full sm:w-64 animate-in fade-in slide-in-from-left-4 duration-200">
                                    <Input
                                        placeholder="Search records..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        leadingIcon={Search}
                                        block
                                    />
                                </div>
                            )}
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
                                        <th className="px-3 py-3 w-[40px]">
                                            <button
                                                onClick={toggleSelectAll}
                                                data-testid="select-all-btn"
                                                className="text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                                            >
                                                {selectedKeys.size === filteredRecords.length && filteredRecords.length > 0 ? (
                                                    <CheckSquare className="size-4" />
                                                ) : (
                                                    <Square className="size-4" />
                                                )}
                                            </button>
                                        </th>
                                        <th className="px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider min-w-[120px]">View</th>
                                        <th className="px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider min-w-[200px]">Name</th>
                                        <th className="px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider min-w-[100px]">Type</th>
                                        <th className="px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider min-w-[90px]">TTL</th>
                                        <th className="px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider min-w-[200px] w-auto">Content</th>
                                        <th className="px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[200px]">Comment</th>
                                        <th className="px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[120px] text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {addingRecordData && (
                                        <InlineEditRow
                                            record={addingRecordData}
                                            availableViews={availableViews}
                                            onSave={handleAddRecord}
                                            onCancel={() => setAddingRecordData(null)}
                                        />
                                    )}
                                    {filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic">
                                                {unifiedRecords.length === 0 ? 'No records found for this domain.' : 'No matching records found.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map((rr) => {
                                            const uniqueKey = getRecordKey(rr);
                                            const isEditing = editingRecordKey === uniqueKey;
                                            const isSelected = selectedKeys.has(uniqueKey);

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
                                                            comments: rr.comments,
                                                        }}
                                                        availableViews={availableViews}
                                                        onSave={async (data) => handleSaveRecord(rr, data)}
                                                        onDelete={async () => handleDeleteRecord(rr)}
                                                        onCancel={() => setEditingRecordKey(null)}
                                                    />
                                                );
                                            }

                                            return (
                                                <tr
                                                    key={uniqueKey}
                                                    className={cn(
                                                        'hover:bg-accent/40 transition-colors group',
                                                        rr.type === 'SOA' && 'bg-primary/[0.03] dark:bg-primary/10',
                                                        rr.disabled && 'opacity-60 grayscale-[0.5]',
                                                        isSelected && 'bg-primary/5',
                                                    )}
                                                >
                                                    <td className="px-3 py-3">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleSelectRecord(uniqueKey, e.shiftKey);
                                                            }}
                                                            data-testid={`select-record-${rr.name}`}
                                                            className={cn(
                                                                'transition-colors focus:outline-none',
                                                                isSelected ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground',
                                                            )}
                                                        >
                                                            {isSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <Badge variant={rr.view === 'default' ? 'secondary' : 'default'}>{rr.view}</Badge>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-2 group/field">
                                                            <span
                                                                title={rr.name}
                                                                className={cn(
                                                                    'text-sm truncate max-w-[200px] block',
                                                                    rr.disabled ? 'text-muted-foreground line-through' : 'text-foreground font-medium',
                                                                )}
                                                            >
                                                                {rr.name}
                                                            </span>
                                                            <CopyButton text={rr.name} className="opacity-0 group-hover/field:opacity-100" />
                                                            {rr.disabled && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px] h-4 px-1 uppercase tracking-wider bg-muted text-muted-foreground border-muted-foreground/30"
                                                                >
                                                                    Disabled
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <Badge variant="outline" className="bg-background">
                                                            {rr.type}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-3 text-sm text-muted-foreground">{rr.ttl}</td>
                                                    <td className="px-3 py-3 text-sm font-mono text-muted-foreground break-all">
                                                        <div className="flex items-center gap-2 group/field">
                                                            <div className="py-0.5">{rr.content}</div>
                                                            <CopyButton text={rr.content} className="opacity-0 group-hover/field:opacity-100 flex-shrink-0" />
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-sm text-muted-foreground break-all">
                                                        {rr.comments?.map((c) => c.content).join('; ') || ''}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8 text-muted-foreground hover:text-foreground"
                                                                onClick={() => handleToggleDisabled(rr)}
                                                                title={rr.disabled ? 'Enable Record' : 'Disable Record'}
                                                            >
                                                                {rr.disabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8 text-muted-foreground hover:text-foreground"
                                                                onClick={() => handleDuplicateRecord(rr)}
                                                                title="Duplicate Record"
                                                                data-testid="duplicate-record-btn"
                                                            >
                                                                <CopyPlus className="size-4" />
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
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
