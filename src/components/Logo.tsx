import React from 'react';

interface LogoProps {
    className?: string;
    size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className, size = 40 }) => {
    return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
            {/* Background Circle */}
            <circle cx="50" cy="50" r="48" fill="url(#logo-gradient)" fillOpacity="0.1" />

            {/* Hexagonal Network Frame */}
            <path d="M50 10L84.64 30V70L50 90L15.36 70V30L50 10Z" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="text-primary/40" />

            {/* Network Nodes */}
            <circle cx="50" cy="10" r="3" fill="currentColor" className="text-primary" />
            <circle cx="84.64" cy="30" r="3" fill="currentColor" className="text-primary" />
            <circle cx="84.64" cy="70" r="3" fill="currentColor" className="text-primary" />
            <circle cx="50" cy="90" r="3" fill="currentColor" className="text-primary" />
            <circle cx="15.36" cy="70" r="3" fill="currentColor" className="text-primary" />
            <circle cx="15.36" cy="30" r="3" fill="currentColor" className="text-primary" />

            {/* Central Lightning Bolt */}
            <path
                d="M55 20L30 55H45L40 85L65 45H50L55 20Z"
                fill="url(#bolt-gradient)"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                className="text-primary"
            />

            <defs>
                <linearGradient id="logo-gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                    <stop stopColor="var(--primary)" />
                    <stop offset="1" stopColor="var(--primary)" stopOpacity="0.5" />
                </linearGradient>
                <linearGradient id="bolt-gradient" x1="40" y1="20" x2="60" y2="85" gradientUnits="userSpaceOnUse">
                    <stop stopColor="currentColor" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0.8" />
                </linearGradient>
            </defs>
        </svg>
    );
};
