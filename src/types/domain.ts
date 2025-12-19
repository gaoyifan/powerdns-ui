
export interface RecordWithView {
    name: string;
    type: string;
    ttl: number;
    content: string;
    disabled: boolean;
    view: string;
    zoneId: string; // The specific API zone ID (e.g. example.com..testview)
}

export interface UnifiedZone {
    name: string;
    views: string[];
    ids: string[];
}
