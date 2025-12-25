import React, { useState } from 'react';
import { Button, Input, Select, DeleteConfirmationModal } from '../components';
import { Save, Trash2, X } from 'lucide-react';
import type { Comment } from '../types/domain';

interface InlineEditRowProps {
    record: {
        name: string;
        type: string;
        ttl: number;
        content: string;
        view: string;
        disabled?: boolean;
        comments?: Comment[];
    };
    availableViews: string[];
    onSave: (data: { name: string; type: string; ttl: number; content: string; view: string; comments: string[] }) => Promise<void>;
    onDelete?: () => Promise<void>;
    onCancel: () => void;
}

export const InlineEditRow: React.FC<InlineEditRowProps> = ({ record, availableViews, onSave, onDelete, onCancel }) => {
    const [name, setName] = useState(record.name);
    const [type, setType] = useState(record.type);
    const [view, setView] = useState(record.view);
    const [ttl, setTtl] = useState(record.ttl);
    const [content, setContent] = useState(record.content);
    const [comment, setComment] = useState((record.comments || []).map((c) => c.content).join('; '));
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Split by semicolon and trim to get array of comments
            const commentsList = comment
                .split(';')
                .map((c) => c.trim())
                .filter((c) => c.length > 0);
            await onSave({ name, type, ttl, content, view, comments: commentsList });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = () => {
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!onDelete) return;
        setDeleting(true);
        try {
            await onDelete();
        } finally {
            setDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    const recordTypes = [
        'A',
        'AAAA',
        'ALIAS',
        'CAA',
        'CNAME',
        'DNAME',
        'HTTPS',
        'LUA',
        'MX',
        'NAPTR',
        'NS',
        'PTR',
        'SOA',
        'SPF',
        'SRV',
        'SSHFP',
        'SVCB',
        'TLSA',
        'TXT',
    ];

    return (
        <tr className="bg-muted/30 border-b border-primary/20">
            <td className="px-3 py-3"></td>
            <td className="px-3 py-3 align-top">
                <Select
                    value={view}
                    onChange={(e) => setView(e.target.value)}
                    options={availableViews.map((v) => ({ value: v, label: v }))}
                    className="h-9 w-full text-sm"
                    block
                    disabled={type === 'SOA'}
                />
            </td>
            <td className="px-3 py-3 align-top">
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-full" block disabled={type === 'SOA'} />
            </td>
            <td className="px-3 py-3 align-top">
                <Select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    options={recordTypes.map((t) => ({ value: t, label: t }))}
                    className="h-9 w-full text-sm"
                    block
                    disabled={type === 'SOA'}
                    hideArrow
                />
            </td>
            <td className="px-3 py-3 align-top">
                <Input
                    type="number"
                    value={ttl}
                    onChange={(e) => setTtl(Number(e.target.value))}
                    className="h-9 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    block
                />
            </td>
            <td className="px-3 py-3 align-top">
                {type === 'SOA' ? (
                    <div className="grid grid-cols-2 gap-2">
                        {(() => {
                            const parts = content.split(/\s+/);
                            // MNAME RNAME SERIAL REFRESH RETRY EXPIRE MINIMUM
                            const names = ['Primary NS', 'Admin Email', 'Serial', 'Refresh', 'Retry', 'Expire', 'Min TTL'];
                            return names.map((label, i) => (
                                <div key={label} className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground">{label}</label>
                                    <Input
                                        value={parts[i] || ''}
                                        onChange={(e) => {
                                            const newParts = [...parts];
                                            while (newParts.length < 7) newParts.push('');
                                            newParts[i] = e.target.value;
                                            setContent(newParts.join(' '));
                                        }}
                                        className="h-8 text-xs font-mono"
                                        block
                                    />
                                </div>
                            ));
                        })()}
                    </div>
                ) : (
                    <Input
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="h-9 w-full"
                        autoFocus
                        block
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') onCancel();
                        }}
                    />
                )}
            </td>
            <td className="px-3 py-3 align-top">
                <Input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    data-testid="record-comment-input"
                    className="h-9 w-full"
                    block
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') onCancel();
                    }}
                />
            </td>
            <td className="px-3 py-3 align-top">
                <div className="flex items-center justify-end gap-1">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={handleSave}
                        loading={saving}
                        title="Save"
                        data-testid="save-record-btn"
                    >
                        <Save className="size-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={onCancel}
                        title="Cancel"
                        data-testid="cancel-edit-btn"
                    >
                        <X className="size-4" />
                    </Button>
                    {onDelete && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={handleDeleteClick}
                            loading={deleting}
                            title="Delete"
                            data-testid="delete-record-btn"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    )}
                </div>
                <DeleteConfirmationModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={confirmDelete}
                    title="Delete Record"
                    description="Are you sure you want to delete this record? This action cannot be undone."
                    loading={deleting}
                />
            </td>
        </tr>
    );
};
