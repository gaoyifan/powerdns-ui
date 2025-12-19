const BASE_URL = import.meta.env.VITE_API_BASE || '/api/v1';

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export const apiClient = {
    request: async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
        const apiKey = localStorage.getItem('pdns_api_key');

        if (!apiKey) {
            throw new Error('No API key found');
        }

        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            ...options.headers,
        };

        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        const contentType = response.headers.get('content-type');

        if (!response.ok) {
            if (response.status === 401) {
                throw new ApiError('Unauthorized', 401);
            }

            if (contentType && contentType.includes('application/json')) {
                const errorJson = await response.json();
                throw new ApiError(errorJson.error || 'API Error', response.status);
            } else {
                const errorText = await response.text();
                // Check if the response is actually an HTML page (likely SPA fallback)
                if (errorText.includes('<!doctype html>') || errorText.includes('<html>')) {
                    throw new ApiError(`API returned HTML (${response.status}) instead of JSON. This often happens when the endpoint is not found or the backend is unreachable.`, response.status);
                }
                throw new ApiError(errorText || 'API Error', response.status);
            }
        }

        if (response.status === 204) {
            return {} as T;
        }

        // Validate that we received JSON
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            if (text.includes('<!doctype html>') || text.includes('<html>')) {
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
