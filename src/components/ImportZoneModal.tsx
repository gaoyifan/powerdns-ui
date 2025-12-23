import React, { useState } from 'react';
import { FileUp, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import zonefile from 'dns-zonefile';
import { Modal, ModalHeader, ModalTitle, ModalDescription, ModalContent, ModalFooter, Button, Select, Flash } from './';
import { filterRedundantRRSets } from '../utils/recordUtils';

interface ImportZoneModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (records: ParsedRecord[], view: string, options: { skipRedundant: boolean }) => Promise<void>;
    availableViews: string[];
    defaultView?: string;
    domainName: string;
    defaultViewRecords?: ParsedRecord[];
}

export interface ParsedRecord {
    name: string;
    type: string;
    ttl: number;
    content: string;
}

export const ImportZoneModal: React.FC<ImportZoneModalProps> = ({
    isOpen,
    onClose,
    onImport,
    availableViews,
    defaultView = 'default',
    domainName,
    defaultViewRecords = [],
}) => {
    const [zoneText, setZoneText] = useState('');
    const [selectedView, setSelectedView] = useState(defaultView);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [skipRedundant, setSkipRedundant] = useState(true);

    // 1. Derive parsed and in-zone records
    const { inZoneRecords, ignoredCount } = React.useMemo(() => {
        if (!zoneText.trim()) return { inZoneRecords: [], ignoredCount: 0 };
        try {
            const parsed = zonefile.parse(zoneText);
            const records: ParsedRecord[] = [];
            const recordTypes = ['a', 'aaaa', 'cname', 'mx', 'txt', 'ns', 'srv', 'ptr', 'spf', 'caa'];
            const defaultTTL = (parsed as any).$ttl || 3600;
            const dotDomain = domainName.endsWith('.') ? domainName.toLowerCase() : (domainName + '.').toLowerCase();
            let ignored = 0;

            const normalizeName = (name: string) => {
                if (name === '@' || !name) return dotDomain;
                return name.endsWith('.') ? name : `${name}.${dotDomain}`;
            };

            const normalizeContent = (content: string, type: string) => {
                if ((type === 'CNAME' || type === 'MX' || type === 'NS' || type === 'PTR' || type === 'SRV' || type === 'ALIAS') && content === '@') {
                    return dotDomain;
                }
                return content;
            };

            recordTypes.forEach(type => {
                const zoneData = parsed as any;
                if (zoneData[type] && Array.isArray(zoneData[type])) {
                    zoneData[type].forEach((r: any) => {
                        const normalizedName = normalizeName(r.name);
                        const lowerName = normalizedName.toLowerCase();
                        if (lowerName !== dotDomain && !lowerName.endsWith('.' + dotDomain)) {
                            ignored++;
                            return;
                        }

                        let content = '';
                        if (type === 'a') content = r.ip;
                        else if (type === 'aaaa') content = r.ip;
                        else if (type === 'cname') content = r.alias;
                        else if (type === 'mx') content = `${r.preference} ${r.host}`;
                        else if (type === 'txt') content = Array.isArray(r.txt) ? r.txt.join(' ') : r.txt;
                        else if (type === 'ns') content = r.host;
                        else if (type === 'srv') content = `${r.priority} ${r.weight} ${r.port} ${r.target}`;
                        else if (type === 'ptr') content = r.host;
                        else if (type === 'spf') content = r.data;
                        else if (type === 'caa') content = `${r.flags} ${r.tag} "${r.value}"`;

                        records.push({
                            name: normalizedName,
                            type: type.toUpperCase(),
                            ttl: r.ttl || defaultTTL,
                            content: normalizeContent(content, type.toUpperCase())
                        });
                    });
                }
            });
            return { inZoneRecords: records, ignoredCount: ignored };
        } catch {
            return { inZoneRecords: [], ignoredCount: 0 };
        }
    }, [zoneText, domainName]);

    // 2. Derive filtered preview (redundancy check)
    const filteredPreview = React.useMemo(() => {
        if (!skipRedundant || selectedView === defaultView || defaultViewRecords.length === 0) {
            return inZoneRecords;
        }
        return filterRedundantRRSets(inZoneRecords, defaultViewRecords, true);
    }, [inZoneRecords, selectedView, skipRedundant, defaultViewRecords, defaultView]);

    const redundantCount = inZoneRecords.length - filteredPreview.length;

    const handleImportClick = async () => {
        if (filteredPreview.length === 0) return;
        setIsImporting(true);
        setError(null);
        try {
            await onImport(filteredPreview, selectedView, { skipRedundant });
            onClose();
            setZoneText('');
        } catch (err: any) {
            setError(err.message || 'Failed to import records');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
            <ModalHeader>
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 text-primary p-2 rounded-xl">
                        <FileUp className="size-5" />
                    </div>
                    <ModalTitle>Import Zone File</ModalTitle>
                </div>
                <ModalDescription>
                    Bulk import records into <strong>{domainName}</strong> from a BIND zone file.
                </ModalDescription>
            </ModalHeader>

            <ModalContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select View</label>
                        <Select
                            value={selectedView}
                            onChange={(e) => setSelectedView(e.target.value)}
                            options={availableViews.map(v => ({ label: v, value: v }))}
                            block
                        />
                    </div>
                    {selectedView !== defaultView && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-xl border border-primary/10 self-end h-[42px]">
                            <input
                                type="checkbox"
                                id="skipRedundant"
                                className="size-4 rounded border-border text-primary focus:ring-primary/20"
                                checked={skipRedundant}
                                onChange={(e) => setSkipRedundant(e.target.checked)}
                            />
                            <label htmlFor="skipRedundant" className="text-sm font-medium cursor-pointer truncate text-xs">
                                Skip redundant records
                            </label>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 flex flex-col">
                        <label className="text-sm font-medium">Zone File Content</label>
                        <textarea
                            className="w-full flex-1 min-h-[300px] p-3 font-mono text-[11px] bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                            placeholder={"$TTL 3600\n@ IN A 1.2.3.4\nwww IN CNAME @"}
                            value={zoneText}
                            onChange={(e) => setZoneText(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2 flex flex-col">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Info className="size-4 text-primary" />
                                Preview ({filteredPreview.length})
                            </label>
                        </div>
                        <div className="flex-1 flex flex-col border border-border rounded-xl bg-muted/5 overflow-hidden">
                            <div className="flex-1 max-h-[270px] overflow-y-auto divide-y divide-border/50">
                                {filteredPreview.length > 0 ? (
                                    filteredPreview.map((r, i) => (
                                        <div key={i} className="px-2 py-1.5 text-[10px] grid grid-cols-12 gap-1 group hover:bg-muted/20 transition-colors">
                                            <div className="col-span-5 font-medium truncate" title={r.name}>{r.name}</div>
                                            <div className="col-span-2 text-primary font-bold uppercase">{r.type}</div>
                                            <div className="col-span-5 text-muted-foreground truncate" title={r.content}>{r.content}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full min-h-[150px] flex flex-col items-center justify-center p-4 text-center space-y-2">
                                        <div className="p-2 bg-muted/20 rounded-full">
                                            <Info className="size-5 text-muted-foreground/30" />
                                        </div>
                                        <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                                            {!zoneText.trim() ? "Paste zone file content\nto see preview"
                                                : redundantCount > 0 ? "All records are redundant\nCheck your view settings"
                                                    : ignoredCount > 0 ? `All records are for domains\nother than ${domainName}`
                                                        : "No valid DNS records\nfound in input"}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {(ignoredCount > 0 || redundantCount > 0) && (
                                <div className="px-2 py-1.5 bg-muted/30 border-t border-border flex flex-wrap gap-x-3 gap-y-1">
                                    {ignoredCount > 0 && (
                                        <span className="text-[10px] text-orange-500 font-medium flex items-center gap-1">
                                            <AlertCircle className="size-3" /> {ignoredCount} out-of-zone
                                        </span>
                                    )}
                                    {redundantCount > 0 && (
                                        <span className="text-[10px] text-primary/70 font-medium flex items-center gap-1">
                                            <ShieldCheck className="size-3" /> {redundantCount} redundant
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {error && (
                    <Flash variant="danger" className="py-2 px-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="size-4 shrink-0" />
                            <span className="text-xs">{error}</span>
                        </div>
                    </Flash>
                )}
            </ModalContent>

            <ModalFooter>
                <Button variant="ghost" onClick={onClose} disabled={isImporting}>
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    onClick={handleImportClick}
                    loading={isImporting}
                    disabled={filteredPreview.length === 0}
                >
                    Import {filteredPreview.length > 0 ? `(${filteredPreview.length})` : ''}
                </Button>
            </ModalFooter>
        </Modal>
    );
};
