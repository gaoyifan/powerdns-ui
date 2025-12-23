import { encode, decode } from '@msgpack/msgpack';

export const COMMENT_RR_TYPE = 'TYPE65534';

/**
 * Encodes data into RFC 3597 hex format after MessagePack encoding
 */
export function encodeMetadata(data: any): string {
    const bytes = encode(data);
    const length = bytes.length;
    let hex = '';
    for (const b of bytes) {
        hex += b.toString(16).padStart(2, '0');
    }
    return `\\# ${length} ${hex}`;
}

/**
 * Decodes RFC 3597 hex format using MessagePack
 */
export function decodeMetadata(content: string): any | null {
    const match = content.match(/^\\#\s+(\d+)\s+([0-9a-fA-F]+)$/);
    if (!match) return null;

    const length = parseInt(match[1], 10);
    const hex = match[2];

    if (hex.length !== length * 2) return null;

    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }

    try {
        return decode(bytes);
    } catch {
        return null;
    }
}
