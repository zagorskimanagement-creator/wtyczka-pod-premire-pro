const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined)
  ?? 'http://localhost:3001/api/v1';

class ApiClient {
  private token: string | null = null;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private getHeaders(isFormData = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json() as { message?: string };
      throw new ApiError(response.status, error.message ?? 'Request failed');
    }

    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json() as { message?: string };
      throw new ApiError(response.status, error.message ?? 'Request failed');
    }

    return response.json() as Promise<T>;
  }

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json() as { message?: string };
      throw new ApiError(response.status, error.message ?? 'Upload failed');
    }

    return response.json() as Promise<T>;
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json() as { message?: string };
      throw new ApiError(response.status, error.message ?? 'Request failed');
    }

    return response.json() as Promise<T>;
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json() as { message?: string };
      throw new ApiError(response.status, error.message ?? 'Request failed');
    }

    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = new ApiClient(BASE_URL);
