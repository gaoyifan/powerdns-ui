
export const COMMENT_RR_TYPE = 'TYPE65534';

/**
 * Encodes a string into RFC 3597 hex format: \# <length> <hex>
 */
export function encodeRFC3597(text: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    const length = bytes.length;
    let hex = '';
    for (const b of bytes) {
        hex += b.toString(16).padStart(2, '0');
    }
    return `\\# ${length} ${hex}`;
}

/**
 * Decodes an RFC 3597 hex string: \# <length> <hex> back to string.
 * Returns null if format doesn't match.
 */
export function decodeRFC3597(content: string): string | null {
    const match = content.match(/^\\#\s+(\d+)\s+([0-9a-fA-F]+)$/);
    if (!match) return null;

    const length = parseInt(match[1], 10);
    const hex = match[2];

    if (hex.length !== length * 2) {
        // Warning: length mismatch, but we can try to decode what we have or fail
        // RFC says length is number of octets.
        return null;
    }

    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }

    const decoder = new TextDecoder();
    return decoder.decode(bytes);
}
