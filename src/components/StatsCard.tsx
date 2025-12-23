import React from 'react';
import { Card, CardContent } from './Card';
import type { LucideIcon } from 'lucide-react';

export interface StatsCardProps {
    title: string;
    value: string | number;
    description: string;
    icon: LucideIcon | React.ElementType;
    loading?: boolean;
    className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, description, icon: Icon, loading, className }) => (
    <Card className={className}>
        <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <div className="bg-primary/10 p-2 rounded-full text-primary">
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            {loading ? <div className="h-8 w-24 bg-muted animate-pulse rounded mt-2" /> : <div className="text-2xl font-bold">{value}</div>}
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardContent>
    </Card>
);
