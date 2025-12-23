import { useState, useEffect, useCallback } from 'react';
import { pdns } from '../api/pdns';
import type { Server, StatisticItem, Zone } from '../types/api';
import type { UnifiedZone } from '../types/domain';
import { parseZoneId } from '../utils/zoneUtils';

export const useZones = () => {
    const [unifiedZones, setUnifiedZones] = useState<UnifiedZone[]>([]);
    const [serverInfo, setServerInfo] = useState<Server | null>(null);
    const [stats, setStats] = useState<StatisticItem[]>([]);
    const [allRawZones, setAllRawZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [zonesRes, serverRes, statsRes] = await Promise.all([
                pdns.getZones(),
                pdns.getServerInfo(),
                pdns.getStatistics().catch(() => [] as StatisticItem[]),
            ]);

            const grouped: Record<string, UnifiedZone> = {};
            zonesRes.forEach((zone) => {
                const { name, view } = parseZoneId(zone.id);

                if (!grouped[name]) {
                    grouped[name] = { name, views: [], ids: [], kinds: [] };
                }
                if (!grouped[name].views.includes(view)) {
                    grouped[name].views.push(view);
                }
                if (zone.kind && !grouped[name].kinds.includes(zone.kind)) {
                    grouped[name].kinds.push(zone.kind);
                }

                // Prefer catalog setting from default view
                if (view === 'default' || !grouped[name].catalog) {
                    grouped[name].catalog = zone.catalog;
                }

                grouped[name].ids.push(zone.id);
            });

            setUnifiedZones(Object.values(grouped));
            setAllRawZones(zonesRes);
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

    return { unifiedZones, allRawZones, serverInfo, stats, loading, error, refetch: fetchData };
};
