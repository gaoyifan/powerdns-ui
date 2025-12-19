export const parseZoneId = (zoneId: string) => {
    // Handle encoded IDs from API (e.g., =5Fmarker)
    const decoded = zoneId.replace(/=5F/g, '_');

    // Check for marker pattern: _marker.<view>.
    const markerMatch = decoded.match(/^_marker\.([^.]+)\.$/);
    if (markerMatch) {
        return { name: decoded, view: markerMatch[1] };
    }

    // Format: "zone_name..view_name"
    if (decoded.includes('..')) {
        const parts = decoded.split('..');
        return { name: parts[0] + '.', view: parts[1] };
    }

    // Normal zone
    return { name: zoneId, view: 'default' };
};

export const getCanonicalZoneName = (zoneInput: string) => {
    return zoneInput.endsWith('.') ? zoneInput : zoneInput + '.';
}

export const formatZoneId = (name: string, view?: string) => {
    const cleanName = name.endsWith('.') ? name.slice(0, -1) : name;
    if (view && view !== 'default') {
        return `${cleanName}..${view}`;
    }
    return name; // or cleanName + '.'? API generally uses trailing dot for Create?
    // Actually API usually returns ID with trailing dot?
};
