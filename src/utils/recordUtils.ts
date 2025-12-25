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
