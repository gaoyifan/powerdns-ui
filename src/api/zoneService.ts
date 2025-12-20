import { apiClient } from './client';

export const zoneService = {
    getZoneId: (domainName: string, view: string) => {
        let targetZoneId = domainName;
        if (!targetZoneId.endsWith('.')) targetZoneId += '.';

        if (view !== 'default') {
            const baseName = targetZoneId.slice(0, -1);
            return `${baseName}..${view}`;
        }
        return targetZoneId;
    },

    ensureZoneExists: async (domainName: string, view: string) => {
        const targetZoneId = zoneService.getZoneId(domainName, view);

        // Check if zone exists
        try {
            await apiClient.request(`/servers/localhost/zones/${targetZoneId}`);
            return targetZoneId;
        } catch (e: any) {
            if (e.status !== 404) throw e;
        }

        // Create if not exists
        await apiClient.request('/servers/localhost/zones', {
            method: 'POST',
            body: JSON.stringify({
                name: targetZoneId,
                kind: 'Native',
                nameservers: ['ns1.localhost.'],
                view: view !== 'default' ? view : undefined
            })
        });

        return targetZoneId;
    },

    patchZone: async (zoneId: string, rrsets: any[]) => {
        return apiClient.request(`/servers/localhost/zones/${zoneId}`, {
            method: 'PATCH',
            body: JSON.stringify({ rrsets })
        });
    }
};
