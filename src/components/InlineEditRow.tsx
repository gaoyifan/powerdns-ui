import React, { useState } from 'react';
import { Button, Input, Badge } from '../components';
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
    onSave: (data: { name: string; type: string; ttl: number; content: string; view: string }) => Promise<void>;
    onDelete: () => Promise<void>;
    onCancel: () => void;
}

export const InlineEditRow: React.FC<InlineEditRowProps> = ({ record, onSave, onDelete, onCancel }) => {
    const [name] = useState(record.name);
    const [type] = useState(record.type);
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

    return (
        <tr className="bg-muted/30 border-b border-primary/20">
            <td className="px-6 py-4 align-top">
                <div className="pt-2">
                    <Badge variant={record.view === 'default' ? 'secondary' : 'default'} className="whitespace-nowrap">
                        {record.view}
                    </Badge>
                </div>
            </td>
            <td className="px-6 py-4 align-top">
                <div className="pt-2">
                    <span className="text-sm font-medium text-muted-foreground">{name}</span>
                </div>
            </td>
            <td className="px-6 py-4 align-top">
                <div className="pt-2">
                    <Badge variant="outline" className="bg-background opacity-70 whitespace-nowrap">
                        {type}
                    </Badge>
                </div>
            </td>
            <td className="px-6 py-4 align-top">
                <Input
                    type="number"
                    value={ttl}
                    onChange={e => setTtl(Number(e.target.value))}
                    className="w-24 h-9"
                />
            </td>
            <td className="px-6 py-4 align-top">
                <Input
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="h-9 min-w-[300px]"
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
                </div>
            </td>
        </tr>
    );
};
