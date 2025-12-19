import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    block?: boolean;
    leadingIcon?: LucideIcon;
    error?: string;
}

export const Input: React.FC<InputProps> = ({
    label,
    block = false,
    leadingIcon: LeadingIcon,
    error,
    className = '',
    id,
    ...props
}) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
        <div className={`${block ? 'w-full' : ''}`}>
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-text-secondary mb-1"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                {LeadingIcon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LeadingIcon className="h-4 w-4 text-text-muted" />
                    </div>
                )}
                <input
                    id={inputId}
                    className={`
            block rounded-md border bg-bg-card
            px-3 py-2 text-base text-text-primary
            placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
            disabled:bg-disabled/20 disabled:text-text-muted disabled:cursor-not-allowed
            transition-all duration-[var(--transition-fast)]
            ${LeadingIcon ? 'pl-10' : ''}
            ${error ? 'border-error focus:ring-error/50' : 'border-border'}
            ${block ? 'w-full' : ''}
            ${className}
          `}
                    {...props}
                />
            </div>
            {error && (
                <p className="mt-1 text-sm text-error">{error}</p>
            )}
        </div>
    );
};
