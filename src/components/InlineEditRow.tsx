import React, { useState } from 'react';
import { Button, Input, Select } from '../components';
import { Save, Trash2 } from 'lucide-react';

interface InlineEditRowProps {
    record: {
        name: string;
        type: string;
        ttl: number;
        content: string;
        view: string;
        disabled?: boolean;
    };
    onSave: (data: { name: string; type: string; ttl: number; content: string; view: string }) => Promise<void>;
    onDelete: () => Promise<void>;
    onCancel: () => void;
}

export const InlineEditRow: React.FC<InlineEditRowProps> = ({ record, onSave, onDelete, onCancel }) => {
    const [name, setName] = useState(record.name);
    const [type, setType] = useState(record.type);
    const [ttl, setTtl] = useState(record.ttl);
    const [content, setContent] = useState(record.content);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({ name, type, ttl, content, view: record.view });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this record?')) return;
        setDeleting(true);
        try {
            await onDelete();
        } finally {
            setDeleting(false);
        }
    };

    const recordTypes = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'PTR', 'SRV', 'NAPTR'];

    return (
        <tr className="bg-muted/30 border-b border-primary/20">
            <td colSpan={5} className="p-4">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Edit Record in {record.view}</h4>
                        <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive/90" onClick={handleDelete} loading={deleting}>
                                <Trash2 className="size-4 mr-1" />
                                Delete
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-3">
                            <label className="text-xs font-semibold mb-1 block">Name</label>
                            <Input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                block
                                disabled={true} // Typically valid API limits changing name of existing RRSet easily without delete/add
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-semibold mb-1 block">Type</label>
                            <Select
                                value={type}
                                onChange={e => setType(e.target.value)}
                                block
                                options={recordTypes.map(t => ({ value: t, label: t }))}
                                disabled={true} // Changing type usually means new RRSet
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-semibold mb-1 block">TTL</label>
                            <Input
                                type="number"
                                value={ttl}
                                onChange={e => setTtl(Number(e.target.value))}
                                block
                            />
                        </div>
                        <div className="col-span-5">
                            <label className="text-xs font-semibold mb-1 block">Content</label>
                            <Input
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                block
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
                        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
                        <Button size="sm" variant="primary" onClick={handleSave} loading={saving}>
                            <Save className="size-4 mr-1" />
                            Save Changes
                        </Button>
                    </div>
                </div>
            </td>
        </tr>
    );
};
