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

        // Fetch attributes from default view to maintain consistency
        let nameservers: string[] = [];
        let kind: 'Native' | 'Master' | 'Slave' = 'Native';

        try {
            const defaultZoneId = zoneService.getZoneId(domainName, 'default');
            const defaultZone = await pdns.getZone(defaultZoneId);

            // Inherit nameservers
            const nsRrset = (defaultZone.rrsets || []).find((r) => r.type === 'NS');
            if (nsRrset && nsRrset.records && nsRrset.records.length > 0) {
                nameservers = nsRrset.records.map((r: any) => r.content);
            }

            // Inherit kind
            if (defaultZone.kind) {
                kind = defaultZone.kind as any;
            }
        } catch (e) {
            // If default zone fetch fails, use fallbacks
            console.warn(`Could not fetch default zone attributes for ${domainName}, using fallbacks.`, e);
        }

        // Create if not exists
        await pdns.createZone({
            name: targetZoneId,
            kind: kind,
            nameservers: nameservers,
        });

        // If specific view, add it to the view
        if (view !== 'default') {
            await pdns.createView(view, targetZoneId);
        }

        return targetZoneId;
    },

    patchZone: async (zoneId: string, rrsets: any[]) => {
        return pdns.patchZone(zoneId, rrsets);
    },
};
