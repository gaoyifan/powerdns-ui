import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    padding = 'md',
}) => {
    return (
        <div
            className={`
        bg-bg-card
        border border-border
        rounded-lg
        shadow-sm
        ${paddingStyles[padding]}
        ${className}
      `}
        >
            {children}
        </div>
    );
};
