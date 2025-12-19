import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    children,
    className,
}) => {
    // Prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 cursor-default">
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Dialog Content Container */}
            <div
                className={cn(
                    "bg-background relative z-50 grid w-full max-w-lg gap-6 rounded-2xl border border-border/50 p-6 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200 sm:rounded-2xl dark:bg-card dark:border-border/30",
                    className
                )}
            >
                {children}

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground/60 opacity-70 transition-all hover:bg-accent hover:text-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                    <X className="size-4" />
                    <span className="sr-only">Close</span>
                </button>
            </div>
        </div>
    );
};

export const ModalHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={cn("flex flex-col gap-1.5 text-left", className)}>
        {children}
    </div>
);

export const ModalTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <h3 className={cn("text-xl font-bold tracking-tight text-foreground", className)}>
        {children}
    </h3>
);

export const ModalDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <p className={cn("text-sm text-muted-foreground leading-relaxed", className)}>
        {children}
    </p>
);

export const ModalFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-4 pt-4 border-t border-border/40", className)}>
        {children}
    </div>
);

export const ModalContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={cn("py-2", className)}>
        {children}
    </div>
);
