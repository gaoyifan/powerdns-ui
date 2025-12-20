import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '../components';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
    id: string;
    type: NotificationType;
    title?: string;
    message: string;
    duration?: number;
}

interface NotificationContextType {
    notifications: Notification[];
    notify: (notification: Omit<Notification, 'id'>) => void;
    dismiss: (id: string) => void;
    confirm: (options: { title: string; message: string; confirmText?: string; cancelText?: string }) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [confirmState, setConfirmState] = useState<{
        resolve: (value: boolean) => void;
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
    } | null>(null);

    const dismiss = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const notify = useCallback((notification: Omit<Notification, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newNotification = { ...notification, id };
        setNotifications(prev => [...prev, newNotification]);

        // Log to console for warning and error
        if (notification.type === 'error') {
            console.error(`[PDNS-UI] ${notification.title || 'Error'}: ${notification.message}`);
        } else if (notification.type === 'warning') {
            console.warn(`[PDNS-UI] ${notification.title || 'Warning'}: ${notification.message}`);
        }

        if (notification.duration !== 0) {
            setTimeout(() => {
                dismiss(id);
            }, notification.duration || 5000);
        }
    }, [dismiss]);

    const confirm = useCallback((options: { title: string; message: string; confirmText?: string; cancelText?: string }) => {
        return new Promise<boolean>((resolve) => {
            setConfirmState({
                resolve,
                title: options.title,
                message: options.message,
                confirmText: options.confirmText,
                cancelText: options.cancelText,
            });
        });
    }, []);

    const handleConfirm = (value: boolean) => {
        if (confirmState) {
            confirmState.resolve(value);
            setConfirmState(null);
        }
    };



    return (
        <NotificationContext.Provider value={{ notifications, notify, dismiss, confirm }}>
            {children}
            {/* Global Toaster Container */}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
                {notifications.map(n => (
                    <div
                        key={n.id}
                        className={cn(
                            "pointer-events-auto flex items-start gap-4 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-top-4 fade-in duration-500",
                            n.type === 'success' && "bg-background/95 border-success/30",
                            n.type === 'error' && "bg-background/95 border-destructive/30",
                            n.type === 'info' && "bg-background/95 border-info/30",
                            n.type === 'warning' && "bg-background/95 border-warning/30"
                        )}
                    >
                        <div className="mt-0.5 p-2 rounded-xl bg-muted/50">
                            {n.type === 'success' && <CheckCircle2 className="size-5 text-success" />}
                            {n.type === 'error' && <AlertCircle className="size-5 text-destructive" />}
                            {n.type === 'info' && <Info className="size-5 text-info" />}
                            {n.type === 'warning' && <AlertCircle className="size-5 text-warning" />}
                        </div>
                        <div className="flex-1 min-w-0 py-1">
                            {n.title && <p className="font-bold text-sm tracking-tight mb-0.5">{n.title}</p>}
                            <p className="text-sm text-muted-foreground leading-relaxed">{n.message}</p>
                        </div>
                        <button
                            onClick={() => dismiss(n.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Global Confirmation Modal */}
            <Modal isOpen={!!confirmState} onClose={() => handleConfirm(false)}>
                {confirmState && (
                    <>
                        <ModalHeader>
                            <ModalTitle>{confirmState.title}</ModalTitle>
                            <ModalDescription className="mt-2 leading-relaxed">
                                {confirmState.message}
                            </ModalDescription>
                        </ModalHeader>
                        <ModalFooter className="gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => handleConfirm(false)}
                            >
                                {confirmState.cancelText || 'Cancel'}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => handleConfirm(true)}
                            >
                                {confirmState.confirmText || 'Confirm'}
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </Modal>
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
