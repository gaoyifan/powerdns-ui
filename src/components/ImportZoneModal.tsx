import React, { useState } from 'react';
import { FileUp, AlertCircle, Info } from 'lucide-react';
import zonefile from 'dns-zonefile';
import { Modal, ModalHeader, ModalTitle, ModalDescription, ModalContent, ModalFooter, Button, Select, Flash } from './';

interface ImportZoneModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (records: ParsedRecord[], view: string) => Promise<void>;
    availableViews: string[];
    defaultView?: string;
    domainName: string;
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
}) => {
    const [zoneText, setZoneText] = useState('');
    const [selectedView, setSelectedView] = useState(defaultView);
    const [isImporting, setIsImporting] = useState(false);
    const [previewRecords, setPreviewRecords] = useState<ParsedRecord[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setZoneText(text);
        setError(null);
        parseAndPreview(text);
    };

    const parseAndPreview = (text: string) => {
        if (!text.trim()) {
            setPreviewRecords([]);
            return;
        }

        try {
            const parsed = zonefile.parse(text);
            const records: ParsedRecord[] = [];

            // Helper to normalize names
            const normalizeName = (name: string) => {
                if (name === '@' || !name) return domainName.endsWith('.') ? domainName : domainName + '.';
                if (name.endsWith('.')) return name;
                const base = domainName.endsWith('.') ? domainName : domainName + '.';
                return `${name}.${base}`;
            };

            const normalizeContent = (content: string, type: string) => {
                if ((type === 'CNAME' || type === 'MX' || type === 'NS' || type === 'PTR' || type === 'SRV') && content === '@') {
                    return domainName.endsWith('.') ? domainName : domainName + '.';
                }
                return content;
            };

            // Common record types handled by dns-zonefile
            const recordTypes = ['a', 'aaaa', 'cname', 'mx', 'txt', 'ns', 'srv', 'ptr', 'spf', 'caa'];

            // Default TTL from zonefile or fallback
            const defaultTTL = parsed.$ttl || 3600;

            recordTypes.forEach(type => {
                const zoneData = parsed as any;
                if (zoneData[type] && Array.isArray(zoneData[type])) {
                    zoneData[type].forEach((r: any) => {
                        let content = '';
                        if (type === 'a') content = r.ip;
                        else if (type === 'aaaa') content = r.ip;
                        else if (type === 'cname') content = r.alias;
                        else if (type === 'mx') content = `${r.preference} ${r.host}`;
                        else if (type === 'txt') {
                            // handle array of strings for TXT
                            content = Array.isArray(r.txt) ? r.txt.join(' ') : r.txt;
                        }
                        else if (type === 'ns') content = r.host;
                        else if (type === 'srv') content = `${r.priority} ${r.weight} ${r.port} ${r.target}`;
                        else if (type === 'ptr') content = r.host;
                        else if (type === 'spf') content = r.data;
                        else if (type === 'caa') content = `${r.flags} ${r.tag} "${r.value}"`;

                        records.push({
                            name: normalizeName(r.name),
                            type: type.toUpperCase(),
                            ttl: r.ttl || defaultTTL,
                            content: normalizeContent(content, type.toUpperCase())
                        });
                    });
                }
            });

            setPreviewRecords(records);
        } catch (err) {
            console.error('Parse error:', err);
            // We don't necessarily want to show an error on every keystroke if it's partial
        }
    };

    const handleImportClick = async () => {
        if (previewRecords.length === 0) {
            setError('No valid records found to import.');
            return;
        }

        setIsImporting(true);
        setError(null);
        try {
            await onImport(previewRecords, selectedView);
            onClose();
            setZoneText('');
            setPreviewRecords([]);
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
                    Paste your BIND zone file content below to bulk import records into <strong>{domainName}</strong>.
                </ModalDescription>
            </ModalHeader>

            <ModalContent className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Select View</label>
                    <Select
                        value={selectedView}
                        onChange={(e) => setSelectedView(e.target.value)}
                        options={availableViews.map(v => ({ label: v, value: v }))}
                        block
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Zone File Content</label>
                    <textarea
                        className="w-full h-64 p-4 font-mono text-sm bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                        placeholder={`$TTL 3600\n@ IN A 1.2.3.4\nwww IN CNAME @`}
                        value={zoneText}
                        onChange={handleTextChange}
                    />
                </div>

                {error && (
                    <Flash variant="danger" className="py-2 px-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="size-4 shrink-0" />
                            <span className="text-xs">{error}</span>
                        </div>
                    </Flash>
                )}

                {previewRecords.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <Info className="size-4 text-primary" />
                                Preview ({previewRecords.length} records)
                            </h4>
                        </div>
                        <div className="max-h-32 overflow-y-auto border border-border rounded-xl bg-muted/10 divide-y divide-border/50">
                            {previewRecords.map((r, i) => (
                                <div key={i} className="px-3 py-2 text-[11px] grid grid-cols-12 gap-2 hover:bg-muted/20 transition-colors">
                                    <div className="col-span-5 font-medium truncate" title={r.name}>{r.name}</div>
                                    <div className="col-span-2 text-primary font-bold">{r.type}</div>
                                    <div className="col-span-5 text-muted-foreground truncate" title={r.content}>{r.content}</div>
                                </div>
                            ))}
                        </div>
                    </div>
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
                    disabled={previewRecords.length === 0}
                >
                    Import {previewRecords.length > 0 ? `(${previewRecords.length})` : ''}
                </Button>
            </ModalFooter>
        </Modal>
    );
};
