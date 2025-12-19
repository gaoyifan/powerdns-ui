import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import type { Zone, Server, StatisticItem } from '../types/api';
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
                apiClient.request<Zone[]>('/servers/localhost/zones'),
                apiClient.request<Server>('/servers/localhost'),
                apiClient.request<StatisticItem[]>('/servers/localhost/statistics').catch(() => [] as StatisticItem[])
            ]);

            const grouped: Record<string, UnifiedZone> = {};
            zonesRes.forEach(zone => {
                const { name, view } = parseZoneId(zone.id);
                // Exclude marker zones
                if (name.startsWith('_marker.')) return;

                if (!grouped[name]) {
                    grouped[name] = { name, views: [], ids: [] };
                }
                grouped[name].views.push(view);
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
