import { apiClient } from './client';
import type { Zone, RRSet, Server, StatisticItem, Network, TSIGKey } from '../types/api';

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

    createZone: async (zone: {
        name: string;
        kind: 'Native' | 'Master' | 'Slave' | 'Producer' | 'Consumer';
        nameservers: string[];
        view?: string;
        catalog?: string;
        master_tsig_key_ids?: string[];
        slave_tsig_key_ids?: string[];
    }) => {
        return apiClient.request('/servers/localhost/zones', {
            method: 'POST',
            body: JSON.stringify(zone),
        });
    },

    deleteZone: async (zoneId: string) => {
        return apiClient.request(`/servers/localhost/zones/${zoneId}`, {
            method: 'DELETE',
        });
    },

    patchZone: async (zoneId: string, rrsets: RRSet[]) => {
        return apiClient.request(`/servers/localhost/zones/${zoneId}`, {
            method: 'PATCH',
            body: JSON.stringify({ rrsets }),
        });
    },

    updateZone: async (zoneId: string, updates: Partial<Zone>) => {
        return apiClient.request(`/servers/localhost/zones/${zoneId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    },

    // TSIG Keys
    getTSIGKeys: async () => {
        return apiClient.request<TSIGKey[]>('/servers/localhost/tsigkeys');
    },

    createTSIGKey: async (key: { name: string; algorithm: string; key?: string }) => {
        return apiClient.request<TSIGKey>('/servers/localhost/tsigkeys', {
            method: 'POST',
            body: JSON.stringify(key),
        });
    },

    deleteTSIGKey: async (keyId: string) => {
        return apiClient.request(`/servers/localhost/tsigkeys/${keyId}`, {
            method: 'DELETE',
        });
    },

    // Views
    getViews: async () => {
        return apiClient.request<{ views: string[] }>('/servers/localhost/views');
    },

    getViewZones: async (view: string) => {
        return apiClient.request<{ zones: string[] }>(`/servers/localhost/views/${view}`);
    },

    /**
     * Add a zone variant to a view
     * @param view View name
     * @param zoneVariantName Full variant name (e.g. "example.com..trusted")
     */
    createView: async (view: string, zoneVariantName: string) => {
        return apiClient.request(`/servers/localhost/views/${view}`, {
            method: 'POST',
            body: JSON.stringify({ name: zoneVariantName }),
        });
    },

    deleteViewZone: async (view: string, zoneName: string) => {
        return apiClient.request(`/servers/localhost/views/${view}/${zoneName}`, {
            method: 'DELETE',
        });
    },

    // Networks
    getNetworks: async () => {
        return apiClient.request<Network[]>('/servers/localhost/networks');
    },

    updateNetwork: async (cidr: string, view: string) => {
        return apiClient.request(`/servers/localhost/networks/${cidr}`, {
            method: 'PUT',
            body: JSON.stringify({ view }),
        });
    },
};
