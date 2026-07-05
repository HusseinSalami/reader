// Customer Service
import { API_URL } from '../config';
import { authService } from './auth';

export interface Customer {
  customerId: string;
  companyName: string;
  subscriptionTier: 'FREE' | 'PRO' | 'ENTERPRISE';
  status: string;
  createdAt: string;
  settings: {
    maxDocumentsPerMonth: number;
    maxUsers: number;
    apiEnabled: boolean;
    webhooksEnabled: boolean;
    mlEnabled: boolean;
    languageSupport: string[];
  };
  contactInfo: {
    email: string;
    phone?: string;
    address?: string;
  };
}

export interface UpdateProfileRequest {
  companyName?: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  };
}

class CustomerService {
  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = authService.getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Request failed');
    }

    return result.data;
  }

  async getProfile(): Promise<Customer> {
    return this.fetchWithAuth(`${API_URL}v1/customers/me`);
  }

  async updateProfile(data: UpdateProfileRequest): Promise<any> {
    return this.fetchWithAuth(`${API_URL}v1/customers/me`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const customerService = new CustomerService();
