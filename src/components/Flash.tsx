import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

type FlashVariant = 'danger' | 'success' | 'warning' | 'info';

interface FlashProps {
    variant?: FlashVariant;
    children: React.ReactNode;
    className?: string;
    dismissible?: boolean;
    onDismiss?: () => void;
}

const variantStyles: Record<FlashVariant, { bg: string; border: string; text: string; icon: typeof AlertCircle }> = {
    danger: {
        bg: 'bg-destructive/10',
        border: 'border-destructive/30',
        text: 'text-destructive',
        icon: AlertCircle,
    },
    success: {
        bg: 'bg-success/10',
        border: 'border-success/30',
        text: 'text-success',
        icon: CheckCircle,
    },
    warning: {
        bg: 'bg-warning/10',
        border: 'border-warning/30',
        text: 'text-warning',
        icon: AlertTriangle,
    },
    info: {
        bg: 'bg-info/10',
        border: 'border-info/30',
        text: 'text-info',
        icon: Info,
    },
};

export const Flash: React.FC<FlashProps> = ({
    variant = 'info',
    children,
    className = '',
    dismissible = false,
    onDismiss,
}) => {
    const styles = variantStyles[variant];
    const Icon = styles.icon;

    return (
        <div
            className={`
        flex items-start gap-3
        ${styles.bg} ${styles.border} ${styles.text}
        border rounded-md p-3
        ${className}
      `}
            role="alert"
        >
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">{children}</div>
            {dismissible && onDismiss && (
                <button
                    onClick={onDismiss}
                    className="flex-shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};
