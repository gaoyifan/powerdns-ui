export interface Comment {
    content: string;
}

export interface RecordWithView {
    name: string;
    type: string;
    ttl: number;
    content: string;
    disabled: boolean;
    view: string;
    zoneId: string; // The specific API zone ID (e.g. example.com..testview)
    comments: Comment[];
}

export interface UnifiedZone {
    name: string;
    views: string[];
    ids: string[];
    catalog?: string;
    kinds: string[];
}
