import React from 'react';

type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'danger' | 'warning';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-border/50 text-text-secondary',
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-text-secondary/10 text-text-secondary',
    success: 'bg-success/10 text-success',
    danger: 'bg-error/10 text-error',
    warning: 'bg-warning/10 text-warning',
};

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'default',
    className = '',
}) => {
    return (
        <span
            className={`
        inline-flex items-center
        px-2 py-0.5
        text-xs font-medium
        rounded-full
        ${variantStyles[variant]}
        ${className}
      `}
        >
            {children}
        </span>
    );
};
