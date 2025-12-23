export const formatRecordContent = (content: string, type: string) => {
    if (type === 'TXT' || type === 'SPF') {
        const trimmed = content.trim();
        if (trimmed.length > 0 && !trimmed.startsWith('"')) {
            return `"${trimmed.replace(/"/g, '\\"')}"`;
        }
    }
    return content;
};

export const normalizeRecordName = (name: string, domainName: string) => {
    let rrName = name;
    if (rrName === '@' || rrName === '') {
        rrName = domainName;
    } else if (!rrName.endsWith(domainName) && !rrName.endsWith(domainName + '.')) {
        rrName += '.' + domainName;
    }
    if (!rrName.endsWith('.')) {
        rrName += '.';
    }
    return rrName;
};

interface RecordLike {
    name: string;
    type: string;
    content: string;
}

/**
 * Filters a list of incoming records by comparing them to a base set of records (e.g. from the default view).
 * An RRSet (records with same name and type) is considered redundant if its entire set of contents
 * matches the corresponding RRSet in the base set.
 */
export const filterRedundantRRSets = <T extends RecordLike>(
    incomingRecords: T[],
    baseRecords: RecordLike[],
    shouldFormatIncoming: boolean = true
): T[] => {
    // 1. Group base records into RRSets for fast lookup
    const baseMap: Record<string, string[]> = {};
    baseRecords.forEach(r => {
        const key = `${r.name}|${r.type.toUpperCase()}`;
        if (!baseMap[key]) baseMap[key] = [];
        baseMap[key].push(r.content);
    });

    // 2. Group incoming records into RRSets
    const incomingRRSets: Record<string, T[]> = {};
    incomingRecords.forEach(r => {
        const key = `${r.name}|${r.type.toUpperCase()}`;
        if (!incomingRRSets[key]) incomingRRSets[key] = [];
        incomingRRSets[key].push(r);
    });

    // 3. Filter groups
    const filteredGroups = Object.values(incomingRRSets).filter(group => {
        const key = `${group[0].name}|${group[0].type.toUpperCase()}`;
        const baseContents = baseMap[key];

        if (!baseContents) return true; // Not redundant if doesn't exist in base

        const incomingContents = group.map(r =>
            shouldFormatIncoming ? formatRecordContent(r.content, r.type.toUpperCase()) : r.content
        );

        if (incomingContents.length !== baseContents.length) return true;

        const sortedIncoming = [...incomingContents].sort();
        const sortedBase = [...baseContents].sort();

        const isIdentical = sortedIncoming.every((content, i) => content === sortedBase[i]);
        return !isIdentical;
    });

    return filteredGroups.flat();
};
