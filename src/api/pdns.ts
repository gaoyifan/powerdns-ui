import { apiClient } from './client';
import type { Zone, RRSet, Server, StatisticItem } from '../types/api';

export const pdns = {
    // Server
    getServerInfo: async () => {
        return apiClient.request<Server>('/servers/localhost');
    },

    getStatistics: async () => {
        return apiClient.request<StatisticItem[]>('/servers/localhost/statistics');
    },

    // Zones
    getZones: async () => {
        return apiClient.request<Zone[]>('/servers/localhost/zones');
    },

    getZone: async (zoneId: string) => {
        return apiClient.request<{ rrsets: RRSet[] } & Zone>(`/servers/localhost/zones/${zoneId}`);
    },

    createZone: async (zone: { name: string; kind: 'Native'; nameservers: string[]; view?: string }) => {
        return apiClient.request('/servers/localhost/zones', {
            method: 'POST',
            body: JSON.stringify(zone)
        });
    },

    deleteZone: async (zoneId: string) => {
        return apiClient.request(`/servers/localhost/zones/${zoneId}`, {
            method: 'DELETE'
        });
    },

    patchZone: async (zoneId: string, rrsets: RRSet[]) => {
        return apiClient.request(`/servers/localhost/zones/${zoneId}`, {
            method: 'PATCH',
            body: JSON.stringify({ rrsets })
        });
    },

    // Views
    getViews: async () => {
        return apiClient.request<{ views: string[] }>('/servers/localhost/views');
    }
};
