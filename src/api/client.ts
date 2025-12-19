import { API_BASE_URL, STORAGE_KEYS } from '../constants';

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}

const isHtml = (text: string) => text.includes('<!doctype html>') || text.includes('<html>');

export const apiClient = {
    request: async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
        const apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);

        if (!apiKey) {
            throw new Error('No API key found');
        }

        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            ...options.headers,
        };

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            cache: 'no-store',
            headers,
        });

        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');

        if (!response.ok) {
            if (response.status === 401) {
                throw new ApiError('Unauthorized', 401);
            }

            let errorMessage = 'API Error';

            if (isJson) {
                try {
                    const errorJson = await response.json();
                    errorMessage = errorJson.error || errorMessage;
                } catch {
                    // ignore json parse error
                }
            } else {
                const errorText = await response.text();
                if (isHtml(errorText)) {
                    errorMessage = `API returned HTML (${response.status}) instead of JSON. Backend might be unreachable.`;
                } else {
                    errorMessage = errorText || errorMessage;
                }
            }
            throw new ApiError(errorMessage, response.status);
        }

        if (response.status === 204) {
            return {} as T;
        }

        if (!isJson) {
            const text = await response.text();
            if (isHtml(text)) {
                throw new ApiError('API returned HTML instead of JSON. Check your backend/proxy configuration.', response.status);
            }
            throw new ApiError('Expected JSON response but received something else', response.status);
        }

        try {
            return await response.json();
        } catch (e) {
            throw new ApiError('Failed to parse JSON response', response.status);
        }
    }
};
