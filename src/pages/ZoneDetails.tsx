import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heading, Flash, Breadcrumbs, Select, Button, FormControl, TextInput } from '@primer/react';
import { PlusIcon } from '@primer/octicons-react';
import { apiClient } from '../api/client';
import { formatZoneId, parseZoneId } from '../utils/zoneUtils';
import type { RRSet, Zone as ZoneType, Zone } from '../types/api';

const Card = ({ children, style }: { children: React.ReactNode, style?: React.CSSProperties }) => (
    <div style={{
        backgroundColor: 'var(--overlay-bgColor-default, #1c2128)',
        border: '1px solid var(--borderColor-default)',
        borderRadius: '6px',
        padding: '16px',
        ...style
    }}>
        {children}
    </div>
);

export const ZoneDetails: React.FC = () => {
    const { name } = useParams<{ name: string }>(); // Canonical name e.g. "example.com."
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
        // Fetch available views for this zone? or just fetch all system views?
        // Better to fetch all system views to allow creating records in new views.
        const fetchMeta = async () => {
            try {
                // Derived from implicit zone markers
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
            // Construct zone ID based on selected view
            const zoneId = formatZoneId(name, selectedView);

            // Try to fetch normal zone
            // If 404, it means the zone doesn't exist in this view (yet).
            try {
                const res = await apiClient.request<ZoneType>(`/servers/localhost/zones/${zoneId}`);
                // Fetch RRsets? They are usually in the zone body for PDNS v1 API.
                // But v1 API for /zones/:id returns "rrsets" array.
                // We need to check if type ZoneType includes rrsets.
                // Assuming it does or we fetch them separately? 
                // PDNS API /zones/:id includes rrsets.
                setRecords((res as any).rrsets || []);
            } catch (err: any) {
                if (err.status === 404 || err.status === 422) {
                    setRecords([]); // Empty records means zone missing in this view
                    // We can show a message: "Zone not active in this view. Adding a record will create it."
                } else {
                    throw err;
                }
            }
        } catch (err: any) {
            setError(err.message);
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

            // 1. Check if zone exists (we rely on 'records' state emptiness or specific 404 check)
            // But we need to be sure. Let's try to fetch it again to be safe or rely on catch.
            // If we are adding to a view, and it doesn't exist, we must create it.

            let zoneExists = true;
            try {
                await apiClient.request(`/servers/localhost/zones/${targetZoneId}`);
            } catch (e: any) {
                if (e.status === 404 || e.status === 422) {
                    zoneExists = false;
                } else {
                    throw e;
                }
            }

            if (!zoneExists) {
                // Auto-create zone for view
                // Show toast or non-blocking notification? We are inside modal, so maybe just proceed.
                // Assuming we use POST /zones to create simple native zone
                // We need to copy kind/masters from default view? Or just make it Native?
                // Plan said: "If missing: Create example.com..internal"

                // We'll create a Native zone.
                await apiClient.request('/servers/localhost/zones', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: targetZoneId,
                        kind: 'Native', // Defaulting to Native
                        nameservers: []
                    })
                });
            }

            // 2. Add Record via PATCH
            // PDNS API: PATCH /zones/:id
            // Body: rrsets: [ { name: ..., type: ..., ttl: ..., changetype: 'REPLACE', records: [...] } ]

            // Name should be fully qualified.
            let rrName = newRecordName;
            if (rrName === '@') rrName = name;
            else if (!rrName.endsWith('.')) rrName += '.' + name; // Append zone name if not FQDN

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

        } catch (err: any) {
            alert('Failed to add record: ' + err.message);
        } finally {
            setCreatingRecord(false);
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <Breadcrumbs style={{ marginBottom: '16px' }}>
                <Breadcrumbs.Item as={Link} to="/zones">Zones</Breadcrumbs.Item>
                <Breadcrumbs.Item href="#" selected>{name}</Breadcrumbs.Item>
            </Breadcrumbs>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Heading>{name}</Heading>
                    <Select value={selectedView} onChange={e => setSelectedView(e.target.value)}>
                        {views.map(v => <Select.Option key={v} value={v}>{v}</Select.Option>)}
                    </Select>
                </div>
                <Button variant="primary" leadingVisual={PlusIcon} onClick={() => setIsRecordDialogOpen(true)}>
                    Add Record
                </Button>
            </div>

            {error && <Flash variant="danger" style={{ marginBottom: '16px' }}>{error}</Flash>}

            {loading && <div style={{ padding: '20px' }}>Loading...</div>}

            {!loading && <Card>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--borderColor-muted)' }}>
                                <th style={{ padding: '8px' }}>Name</th>
                                <th style={{ padding: '8px' }}>Type</th>
                                <th style={{ padding: '8px' }}>TTL</th>
                                <th style={{ padding: '8px' }}>Content</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--fgColor-muted)' }}>
                                        No records found in view "{selectedView}".
                                        {/* TODO: Add logic to create zone */}
                                    </td>
                                </tr>
                            ) : records.map((rr, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--borderColor-muted)' }}>
                                    <td style={{ padding: '8px' }}>{rr.name}</td>
                                    <td style={{ padding: '8px' }}>{rr.type}</td>
                                    <td style={{ padding: '8px' }}>{rr.ttl}</td>
                                    <td style={{ padding: '8px' }}>
                                        {rr.records.map((r, j) => (
                                            <div key={j}>{r.content}</div>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>}

            {isRecordDialogOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div style={{ backgroundColor: '#1c2128', padding: '24px', borderRadius: '6px', width: '500px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', border: '1px solid var(--borderColor-default)' }}>
                        <Heading style={{ fontSize: '18px', marginBottom: '16px' }}>
                            Add Record to {selectedView === 'default' ? 'Default View' : `View "${selectedView}"`}
                        </Heading>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <FormControl>
                                <FormControl.Label>Name (@ for root)</FormControl.Label>
                                <TextInput block value={newRecordName} onChange={e => setNewRecordName(e.target.value)} placeholder="www" autoFocus />
                            </FormControl>
                            <FormControl>
                                <FormControl.Label>Type</FormControl.Label>
                                <Select block value={newRecordType} onChange={e => setNewRecordType(e.target.value)}>
                                    {['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'PTR', 'SRV', 'NAPTR'].map(t => (
                                        <Select.Option key={t} value={t}>{t}</Select.Option>
                                    ))}
                                </Select>
                            </FormControl>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '16px', marginTop: '16px' }}>
                            <FormControl>
                                <FormControl.Label>TTL</FormControl.Label>
                                <TextInput block type="number" value={newRecordTTL} onChange={e => setNewRecordTTL(Number(e.target.value))} />
                            </FormControl>
                            <FormControl>
                                <FormControl.Label>Content</FormControl.Label>
                                <TextInput block value={newRecordContent} onChange={e => setNewRecordContent(e.target.value)} placeholder="1.2.3.4" />
                            </FormControl>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                            <Button onClick={() => setIsRecordDialogOpen(false)}>Cancel</Button>
                            <Button variant="primary" disabled={creatingRecord || !newRecordContent} onClick={handleAddRecord}>
                                {creatingRecord ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
