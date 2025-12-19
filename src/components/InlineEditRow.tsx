import React, { useState } from 'react';
import { Button, Input, Select } from '../components';
import { Save, Trash2, X } from 'lucide-react';

interface InlineEditRowProps {
    record: {
        name: string;
        type: string;
        ttl: number;
        content: string;
        view: string;
        disabled?: boolean;
    };
    availableViews: string[];
    onSave: (data: { name: string; type: string; ttl: number; content: string; view: string }) => Promise<void>;
    onDelete?: () => Promise<void>;
    onCancel: () => void;
}

export const InlineEditRow: React.FC<InlineEditRowProps> = ({ record, availableViews, onSave, onDelete, onCancel }) => {
    const [name, setName] = useState(record.name);
    const [type, setType] = useState(record.type);
    const [view, setView] = useState(record.view);
    const [ttl, setTtl] = useState(record.ttl);
    const [content, setContent] = useState(record.content);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({ name, type, ttl, content, view });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this record?')) return;
        setDeleting(true);
        try {
            if (onDelete) await onDelete();
        } finally {
            setDeleting(false);
        }
    };

    const recordTypes = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'PTR', 'SRV', 'NAPTR'];

    return (
        <tr className="bg-muted/30 border-b border-primary/20">
            <td className="px-6 py-4 align-top">
                <Select
                    value={view}
                    onChange={e => setView(e.target.value)}
                    options={availableViews.map(v => ({ value: v, label: v }))}
                    className="h-9 w-full"
                    block
                />
            </td>
            <td className="px-6 py-4 align-top">
                <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="h-9 w-full"
                    block
                />
            </td>
            <td className="px-6 py-4 align-top">
                <Select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    options={recordTypes.map(t => ({ value: t, label: t }))}
                    className="h-9 w-full"
                    block
                />
            </td>
            <td className="px-6 py-4 align-top">
                <Input
                    type="number"
                    value={ttl}
                    onChange={e => setTtl(Number(e.target.value))}
                    className="h-9 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    block
                />
            </td>
            <td className="px-6 py-4 align-top">
                <Input
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="h-9 w-full"
                    autoFocus
                    block
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') onCancel();
                    }}
                />
            </td>
            <td className="px-6 py-4 align-top">
                <div className="flex items-center gap-1">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={handleSave}
                        loading={saving}
                        title="Save"
                    >
                        <Save className="size-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={onCancel}
                        title="Cancel"
                    >
                        <X className="size-4" />
                    </Button>
                    {onDelete && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={handleDelete}
                            loading={deleting}
                            title="Delete"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    )}
                </div>
            </td>
        </tr>
    );
};
