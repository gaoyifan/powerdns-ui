import type { RRSet } from './api';

export interface RecordWithView extends RRSet {
    view: string;
    zoneId: string; // The specific API zone ID (e.g. example.com..testview)
}

export interface UnifiedZone {
    name: string;
    views: string[];
    ids: string[];
}
