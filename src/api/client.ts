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

        if (!response.ok) {
            if (response.status === 401) {
                throw new ApiError('Unauthorized', 401);
            }
            const errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                throw new ApiError(errorJson.error || 'API Error', response.status);
            } catch (e) {
                throw new ApiError(errorText || 'API Error', response.status);
            }
        }

        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }
};
