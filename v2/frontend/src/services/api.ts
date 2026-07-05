import { API_BASE_URL } from '../config';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private getHeaders(contentType?: string): HeadersInit {
    const headers: HeadersInit = {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('tenant');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: this.getHeaders('application/json'),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders('application/json'),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  async uploadFile<T>(path: string, file: File): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getToken()}` },
      body: formData,
    });
    return this.handleResponse<T>(response);
  }

  getDownloadUrl(path: string): string {
    return `${API_BASE_URL}${path}`;
  }

  async downloadFile(path: string, filename: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const api = new ApiClient();

// Auth helpers
export function login(token: string, tenant: { id: string; name: string; email: string }) {
  localStorage.setItem('token', token);
  localStorage.setItem('tenant', JSON.stringify(tenant));
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('tenant');
  window.location.href = '/login';
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token');
}

export function getTenant(): { id: string; name: string; email: string } | null {
  const raw = localStorage.getItem('tenant');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
