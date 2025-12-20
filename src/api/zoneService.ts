import { pdns } from './pdns';

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
            await pdns.getZone(targetZoneId);
            return targetZoneId;
        } catch (e: any) {
            if (e.status !== 404) throw e;
        }

        // Fetch nameservers from default view to maintain consistency
        let nameservers: string[] = []; // Default fallback
        try {
            const defaultZoneId = zoneService.getZoneId(domainName, 'default');
            const defaultZone = await pdns.getZone(defaultZoneId);

            // Look for NS records in the rrsets
            const nsRrset = (defaultZone.rrsets || []).find(r => r.type === 'NS');
            if (nsRrset && nsRrset.records && nsRrset.records.length > 0) {
                nameservers = nsRrset.records.map((r: any) => r.content);
            }
        } catch (e) {
            // If default zone fetch fails or no NS records, use empty fallback
            console.warn(`Could not fetch default zone nameservers for ${domainName}, using empty fallback.`, e);
        }

        // Create if not exists
        await pdns.createZone({
            name: targetZoneId,
            kind: 'Native',
            nameservers: nameservers
        });

        // If specific view, add it to the view
        if (view !== 'default') {
            await pdns.createView(view, targetZoneId);
        }

        return targetZoneId;
    },

    patchZone: async (zoneId: string, rrsets: any[]) => {
        return pdns.patchZone(zoneId, rrsets);
    }
};
