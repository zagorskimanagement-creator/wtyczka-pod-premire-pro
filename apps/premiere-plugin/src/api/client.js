const BASE_URL = import.meta.env['VITE_API_URL']
    ?? 'http://localhost:3001/api/v1';
class ApiClient {
    constructor(baseUrl) {
        this.token = null;
        this.baseUrl = baseUrl;
    }
    setToken(token) {
        this.token = token;
    }
    getHeaders(isFormData = false) {
        const headers = {};
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }
    async get(path) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new ApiError(response.status, error.message ?? 'Request failed');
        }
        return response.json();
    }
    async post(path, body) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const error = await response.json();
            throw new ApiError(response.status, error.message ?? 'Request failed');
        }
        return response.json();
    }
    async postFormData(path, formData) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: formData,
        });
        if (!response.ok) {
            const error = await response.json();
            throw new ApiError(response.status, error.message ?? 'Upload failed');
        }
        return response.json();
    }
    async patch(path, body) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const error = await response.json();
            throw new ApiError(response.status, error.message ?? 'Request failed');
        }
        return response.json();
    }
    async delete(path) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new ApiError(response.status, error.message ?? 'Request failed');
        }
        if (response.status === 204)
            return {};
        return response.json();
    }
}
export class ApiError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'ApiError';
    }
}
export const apiClient = new ApiClient(BASE_URL);
