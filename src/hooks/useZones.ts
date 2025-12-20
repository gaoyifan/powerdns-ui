import { useState, useEffect, useCallback } from 'react';
import { pdns } from '../api/pdns';
import type { Server, StatisticItem } from '../types/api';
import type { UnifiedZone } from '../types/domain';
import { parseZoneId } from '../utils/zoneUtils';

export const useZones = () => {
    const [unifiedZones, setUnifiedZones] = useState<UnifiedZone[]>([]);
    const [serverInfo, setServerInfo] = useState<Server | null>(null);
    const [stats, setStats] = useState<StatisticItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [zonesRes, serverRes, statsRes] = await Promise.all([
                pdns.getZones(),
                pdns.getServerInfo(),
                pdns.getStatistics().catch(() => [] as StatisticItem[])
            ]);

            const grouped: Record<string, UnifiedZone> = {};
            zonesRes.forEach(zone => {
                const { name, view } = parseZoneId(zone.id);
                // Exclude marker zones
                if (name.startsWith('_marker.')) return;

                if (!grouped[name]) {
                    grouped[name] = { name, views: [], ids: [] };
                }
                if (!grouped[name].views.includes(view)) {
                    grouped[name].views.push(view);
                }
                grouped[name].ids.push(zone.id);
            });

            setUnifiedZones(Object.values(grouped));
            setServerInfo(serverRes);
            setStats(statsRes);
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { unifiedZones, serverInfo, stats, loading, error, refetch: fetchData };
};
