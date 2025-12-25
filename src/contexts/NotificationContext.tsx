import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
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
    notify: (notification: Omit<Notification, 'id'>) => void;
    dismiss: (id: string | number) => void;
    confirm: (options: { title: string; message: string; confirmText?: string; cancelText?: string }) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [confirmState, setConfirmState] = useState<{
        resolve: (value: boolean) => void;
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
    } | null>(null);

    const dismiss = useCallback((id: string | number) => {
        toast.dismiss(id);
    }, []);

    const notify = useCallback((notification: Omit<Notification, 'id'>) => {
        const { type, title, message, duration } = notification;
        const options = {
            description: title ? message : undefined,
            duration: duration || 4000,
        };
        const toastMessage = title || message;

        switch (type) {
            case 'success':
                toast.success(toastMessage, options);
                break;
            case 'error':
                console.error(`[PDNS-UI] ${title || 'Error'}: ${message}`);
                toast.error(toastMessage, options);
                break;
            case 'warning':
                console.warn(`[PDNS-UI] ${title || 'Warning'}: ${message}`);
                toast.warning(toastMessage, options);
                break;
            case 'info':
            default:
                toast.message(toastMessage, options);
                break;
        }
    }, []);

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
        <NotificationContext.Provider value={{ notify, dismiss, confirm }}>
            {children}
            <Toaster position="bottom-right" richColors closeButton theme="system" />

            {/* Global Confirmation Modal */}
            <Modal isOpen={!!confirmState} onClose={() => handleConfirm(false)}>
                {confirmState && (
                    <>
                        <ModalHeader>
                            <ModalTitle>{confirmState.title}</ModalTitle>
                            <ModalDescription className="mt-2 leading-relaxed">{confirmState.message}</ModalDescription>
                        </ModalHeader>
                        <ModalFooter className="gap-3">
                            <Button variant="ghost" onClick={() => handleConfirm(false)}>
                                {confirmState.cancelText || 'Cancel'}
                            </Button>
                            <Button variant="primary" onClick={() => handleConfirm(true)} autoFocus>
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
