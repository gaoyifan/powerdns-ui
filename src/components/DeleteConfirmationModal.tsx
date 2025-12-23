import React from 'react';
import { Button, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '../components';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    loading?: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, description, loading = false }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalHeader>
                <ModalTitle>{title}</ModalTitle>
                <ModalDescription>{description}</ModalDescription>
            </ModalHeader>
            <ModalFooter>
                <Button variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="destructive" onClick={onConfirm} loading={loading}>
                    Delete
                </Button>
            </ModalFooter>
        </Modal>
    );
};
