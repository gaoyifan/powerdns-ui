import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface InputProps extends React.ComponentProps<'input'> {
    label?: string;
    block?: boolean;
    leadingIcon?: LucideIcon;
    error?: string;
}

export const Input: React.FC<InputProps> = ({ label, block = false, leadingIcon: LeadingIcon, error, className = '', id, type = 'text', ...props }) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
        <div className={cn('flex flex-col gap-1.5', block ? 'w-full' : 'w-min')}>
            {label && (
                <label htmlFor={inputId} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {label}
                </label>
            )}
            <div className="relative">
                {LeadingIcon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LeadingIcon className="size-4 text-muted-foreground" />
                    </div>
                )}
                <input
                    id={inputId}
                    type={type}
                    data-slot="input"
                    className={cn(
                        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-all outline-none md:text-sm',
                        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
                        'dark:bg-input/30',
                        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                        LeadingIcon && 'pl-10',
                        error && 'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
                        className,
                    )}
                    aria-invalid={!!error}
                    {...props}
                />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
    );
};
