import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, ChevronRight } from 'lucide-react';
import { apiClient } from '../api/client';
import { formatZoneId, parseZoneId } from '../utils/zoneUtils';
import type { RRSet, Zone as ZoneType, Zone } from '../types/api';
import { Button, Card, Flash, Modal, Input, Select } from '../components';

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
        <div className="p-6 max-w-5xl mx-auto">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm text-text-secondary mb-4">
                <Link to="/zones" className="hover:text-primary transition-colors">Zones</Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-text-primary font-medium">{name}</span>
            </nav>

            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-semibold text-text-primary">{name}</h1>
                    <Select
                        value={selectedView}
                        onChange={e => setSelectedView(e.target.value)}
                    >
                        {views.map(v => <option key={v} value={v}>{v}</option>)}
                    </Select>
                </div>
                <Button variant="primary" leadingIcon={Plus} onClick={() => setIsRecordDialogOpen(true)}>
                    Add Record
                </Button>
            </div>

            {error && <Flash variant="danger" className="mb-4">{error}</Flash>}

            {loading && <div className="p-5 text-text-secondary">Loading...</div>}

            {!loading && (
                <Card padding="none">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b border-border bg-bg-page/50">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Name</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Type</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">TTL</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Content</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {records.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                                            No records found in view "{selectedView}".
                                        </td>
                                    </tr>
                                ) : records.map((rr, i) => (
                                    <tr key={i} className="hover:bg-border/10 transition-colors">
                                        <td className="px-4 py-3 text-sm text-text-primary">{rr.name}</td>
                                        <td className="px-4 py-3 text-sm text-text-primary">{rr.type}</td>
                                        <td className="px-4 py-3 text-sm text-text-secondary">{rr.ttl}</td>
                                        <td className="px-4 py-3 text-sm text-text-primary">
                                            {rr.records.map((r, j) => (
                                                <div key={j}>{r.content}</div>
                                            ))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Modal isOpen={isRecordDialogOpen} onClose={() => setIsRecordDialogOpen(false)} title={`Add Record to ${selectedView === 'default' ? 'Default View' : `View "${selectedView}"`}`} width="lg">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Name (@ for root)"
                            value={newRecordName}
                            onChange={e => setNewRecordName(e.target.value)}
                            placeholder="www"
                            block
                            autoFocus
                        />
                        <Select
                            label="Type"
                            value={newRecordType}
                            onChange={e => setNewRecordType(e.target.value)}
                            block
                            options={recordTypes.map(t => ({ value: t, label: t }))}
                        />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <Input
                            label="TTL"
                            type="number"
                            value={newRecordTTL}
                            onChange={e => setNewRecordTTL(Number(e.target.value))}
                            block
                        />
                        <div className="col-span-3">
                            <Input
                                label="Content"
                                value={newRecordContent}
                                onChange={e => setNewRecordContent(e.target.value)}
                                placeholder="1.2.3.4"
                                block
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button onClick={() => setIsRecordDialogOpen(false)}>Cancel</Button>
                        <Button variant="primary" disabled={creatingRecord || !newRecordContent} onClick={handleAddRecord} loading={creatingRecord}>
                            {creatingRecord ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
