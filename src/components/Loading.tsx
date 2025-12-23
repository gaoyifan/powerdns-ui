import React from 'react';
import { cn } from '../lib/utils';

interface LoadingProps {
    className?: string;
}

export const Loading: React.FC<LoadingProps> = ({ className }) => (
    <div className={cn('py-12 flex justify-center', className)}>
        <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
);
