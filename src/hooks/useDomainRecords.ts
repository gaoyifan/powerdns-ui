import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import type { Zone, RRSet } from '../types/api';
import type { RecordWithView } from '../types/domain';
import { parseZoneId } from '../utils/zoneUtils';

export const useDomainRecords = (domainName: string | undefined) => {
    const [unifiedRecords, setUnifiedRecords] = useState<RecordWithView[]>([]);
    const [availableViews, setAvailableViews] = useState<string[]>(['default']);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!domainName) return;
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch ALL zones to discover which views this domain exists in
            const allZones = await apiClient.request<Zone[]>('/servers/localhost/zones');

            // 2. Identify relevant zones for this domain
            const relevantZones = allZones.filter(z => {
                const parsed = parseZoneId(z.id);
                return parsed.name === domainName || parsed.name === domainName + '.';
            });

            // 3. Find ALL system views to populate the dropdown
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
    }, [domainName]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { unifiedRecords, availableViews, loading, error, refetch: fetchData };
};
