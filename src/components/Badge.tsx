import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva(
    'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    {
        variants: {
            variant: {
                default: 'border-transparent bg-primary text-primary-foreground',
                secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
                outline: 'text-foreground',
                destructive: 'border-transparent bg-destructive text-white',
                success: 'border-transparent bg-success text-white',
                warning: 'border-transparent bg-warning text-white',
                info: 'border-transparent bg-info text-white',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge: React.FC<BadgeProps> = ({ children, variant, className, ...props }) => {
    return (
        <span className={cn(badgeVariants({ variant }), className)} {...props}>
            {children}
        </span>
    );
};
