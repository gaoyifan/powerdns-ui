import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    {
        variants: {
            variant: {
                primary: 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 rounded-xl',
                destructive:
                    'bg-destructive text-white shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
                secondary:
                    'border border-border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
                ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                sm: 'h-8 rounded-lg gap-1.5 px-3',
                md: 'h-9 px-4 py-2',
                lg: 'h-10 px-6',
                icon: 'size-9 rounded-lg',
            },
            block: {
                true: 'w-full',
                false: '',
            }
        },
        defaultVariants: {
            variant: 'secondary',
            size: 'md',
            block: false,
        },
    }
);

interface ButtonProps<T extends React.ElementType = 'button'> extends VariantProps<typeof buttonVariants> {
    leadingIcon?: LucideIcon;
    loading?: boolean;
    as?: T;
    children?: React.ReactNode;
    className?: string;
}

export const Button = <T extends React.ElementType = 'button'>({
    children,
    variant,
    size,
    block,
    leadingIcon: LeadingIcon,
    loading = false,
    className,
    as: Component = 'button' as any,
    ...props
}: ButtonProps<T> & React.ComponentPropsWithoutRef<T>) => {
    return (
        <Component
            className={cn(buttonVariants({ variant, size, block, className }))}
            {...props as any}
        >
            {loading ? (
                <svg className="animate-spin size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : LeadingIcon ? (
                <LeadingIcon className="size-4" />
            ) : null}
            {children}
        </Component>
    );
};
