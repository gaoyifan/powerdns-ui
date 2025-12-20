import { useState, useEffect, useCallback } from 'react';
import { pdns } from '../api/pdns';

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
            // 1. Fetch ALL zones and views
            const [allZones, viewsRes] = await Promise.all([
                pdns.getZones(),
                pdns.getViews().catch(() => ({ views: [] }))
            ]);

            // 2. Identify relevant zones for this domain
            const relevantZones = allZones.filter(z => {
                const parsed = parseZoneId(z.id);
                return parsed.name === domainName || parsed.name === domainName + '.';
            });

            // 3. Set available views from API
            const foundViews = new Set<string>(['default', ...(viewsRes.views || [])]);
            setAvailableViews(Array.from(foundViews).sort());

            // 4. Fetch Details for each relevant zone to get records
            const recordPromises = relevantZones.map(async (zone) => {
                const { view } = parseZoneId(zone.id);
                try {
                    const detailedZone = await pdns.getZone(zone.id);
                    return (detailedZone.rrsets || []).flatMap(rr =>
                        rr.records.map(record => ({
                            name: rr.name,
                            type: rr.type,
                            ttl: rr.ttl,
                            content: record.content,
                            disabled: record.disabled,
                            view: view,
                            zoneId: zone.id,
                            comments: []
                        }))
                    );
                } catch (e) {
                    console.error(`Failed to fetch zone details for ${zone.id}`, e);
                    return [];
                }
            });

            const results = await Promise.all(recordPromises);
            const flatRecords = results.flat();

            // Sort by name, then type, then view, then content
            flatRecords.sort((a, b) => {
                if (a.name !== b.name) return a.name.localeCompare(b.name);
                if (a.type !== b.type) return a.type.localeCompare(b.type);
                if (a.view !== b.view) return a.view.localeCompare(b.view);
                return a.content.localeCompare(b.content);
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
