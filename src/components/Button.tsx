import React from 'react';
import type { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    block?: boolean;
    leadingIcon?: LucideIcon;
    loading?: boolean;
    as?: React.ElementType;
    to?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-hover focus:ring-primary/50',
    secondary: 'bg-transparent border border-border text-text-primary hover:bg-border/20 focus:ring-border/50',
    danger: 'bg-error text-white hover:bg-error/80 focus:ring-error/50',
    ghost: 'bg-transparent text-text-secondary hover:bg-border/20 hover:text-text-primary',
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-2 py-1 text-sm gap-1',
    md: 'px-4 py-2 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2',
};

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'secondary',
    size = 'md',
    block = false,
    leadingIcon: LeadingIcon,
    loading = false,
    disabled,
    className = '',
    as: Component = 'button',
    ...props
}) => {
    const baseStyles = `
    inline-flex items-center justify-center
    font-medium rounded-md
    transition-all duration-[var(--transition-fast)]
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

    return (
        <Component
            className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${block ? 'w-full' : ''}
        ${className}
      `}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {!loading && LeadingIcon && <LeadingIcon className="w-4 h-4" />}
            {children}
        </Component>
    );
};
