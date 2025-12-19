import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, ChevronRight, LayoutList, ShieldCheck } from 'lucide-react';
import { apiClient } from '../api/client';
import { formatZoneId, parseZoneId } from '../utils/zoneUtils';
import type { RRSet, Zone as ZoneType, Zone } from '../types/api';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Flash, Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Input, Select, Badge } from '../components';

export const ZoneDetails: React.FC = () => {
    const { name } = useParams<{ name: string }>();
    const [views, setViews] = useState<string[]>(['default']);
    const [selectedView, setSelectedView] = useState('default');
    const [records, setRecords] = useState<RRSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Record Creation State
    const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
    const [newRecordName, setNewRecordName] = useState('');
    const [newRecordType, setNewRecordType] = useState('A');
    const [newRecordTTL, setNewRecordTTL] = useState(3600);
    const [newRecordContent, setNewRecordContent] = useState('');
    const [creatingRecord, setCreatingRecord] = useState(false);

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const zoneRes = await apiClient.request<Zone[]>('/servers/localhost/zones');
                const foundViews = new Set<string>(['default']);
                zoneRes.forEach(zone => {
                    const { view } = parseZoneId(zone.name);
                    if (view) foundViews.add(view);
                });
                setViews(Array.from(foundViews).sort());
            } catch (e) {
                console.error(e);
            }
        };
        fetchMeta();
    }, []);

    const fetchRecords = async () => {
        if (!name) return;
        setLoading(true);
        setError(null);
        try {
            const zoneId = formatZoneId(name, selectedView);

            try {
                const res = await apiClient.request<ZoneType>(`/servers/localhost/zones/${zoneId}`);
                setRecords((res as { rrsets?: RRSet[] }).rrsets || []);
            } catch (err: unknown) {
                const error = err as { status?: number };
                if (error.status === 404 || error.status === 422) {
                    setRecords([]);
                } else {
                    throw err;
                }
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load records');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [name, selectedView]);

    const handleAddRecord = async () => {
        if (!name || !newRecordContent) return;
        setCreatingRecord(true);
        setError(null);

        try {
            const targetZoneId = formatZoneId(name, selectedView);

            let zoneExists = true;
            try {
                await apiClient.request(`/servers/localhost/zones/${targetZoneId}`);
            } catch (e: unknown) {
                const error = e as { status?: number };
                if (error.status === 404 || error.status === 422) {
                    zoneExists = false;
                } else {
                    throw e;
                }
            }

            if (!zoneExists) {
                await apiClient.request('/servers/localhost/zones', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: targetZoneId,
                        kind: 'Native',
                        nameservers: []
                    })
                });
            }

            let rrName = newRecordName;
            if (rrName === '@') rrName = name;
            else if (!rrName.endsWith('.')) rrName += '.' + name;

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
            fetchRecords();

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
                <Link to="/zones" className="hover:text-primary transition-colors">Zones</Link>
                <ChevronRight className="size-4" />
                <span className="text-foreground font-semibold">{name}</span>
            </nav>

            <div className="flex justify-between items-end">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 text-primary p-3 rounded-2xl">
                        <LayoutList className="size-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-muted-foreground uppercase tracking-widest text-[10px]">
                                Zone Records
                            </Badge>
                            <Select
                                value={selectedView}
                                onChange={e => setSelectedView(e.target.value)}
                                className="h-7 text-xs py-0 min-w-[100px]"
                            >
                                {views.map(v => <option key={v} value={v}>{v}</option>)}
                            </Select>
                        </div>
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
                    <CardDescription>All DNS records defined for this zone in the "{selectedView}" view.</CardDescription>
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
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-24">TTL</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Content</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {records.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic">
                                                No records found in view "{selectedView}".
                                            </td>
                                        </tr>
                                    ) : records.map((rr, i) => (
                                        <tr key={i} className="hover:bg-accent/40 transition-colors group">
                                            <td className="px-6 py-4 text-sm font-medium">{rr.name}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className="bg-background group-hover:bg-primary/5 transition-colors">{rr.type}</Badge>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-muted-foreground">{rr.ttl}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-muted-foreground break-all">
                                                {rr.records.map((r, j) => (
                                                    <div key={j} className="py-0.5">{r.content}</div>
                                                ))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Modal isOpen={isRecordDialogOpen} onClose={() => setIsRecordDialogOpen(false)}>
                <ModalHeader>
                    <ModalTitle>{`Add Record to ${selectedView === 'default' ? 'Default View' : `View "${selectedView}"`}`}</ModalTitle>
                </ModalHeader>
                <ModalContent className="space-y-6">
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
