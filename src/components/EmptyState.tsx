import React from 'react';
import { cn } from '../lib/utils';

interface EmptyStateProps {
    message?: string;
    className?: string;
    children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, className, children }) => (
    <div className={cn('py-12 text-center border-2 border-dashed border-border rounded-xl', className)}>
        {message && <p className="text-muted-foreground italic">{message}</p>}
        {children}
    </div>
);
