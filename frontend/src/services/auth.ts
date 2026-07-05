// Authentication Service
import { API_URL, AUTH_CONFIG } from '../config';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  companyName: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  subscriptionTier?: 'FREE' | 'PRO' | 'ENTERPRISE';
}

export interface AuthResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  email: string;
  customerId: string;
  role: string;
}

class AuthService {
  async register(data: RegisterRequest) {
    const response = await fetch(`${API_URL}auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Registration failed');
    }

    return result.data;
  }

  async login(data: LoginRequest) {
    const response = await fetch(`${API_URL}auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Login failed');
    }

    const authData: AuthResponse = result.data;
    
    // Store ID token (contains custom attributes) instead of access token
    localStorage.setItem(AUTH_CONFIG.tokenKey, authData.idToken);
    localStorage.setItem(AUTH_CONFIG.refreshTokenKey, authData.refreshToken);
    
    // Decode and store user info from ID token
    const user = this.decodeToken(authData.idToken);
    localStorage.setItem(AUTH_CONFIG.userKey, JSON.stringify(user));

    return authData;
  }

  logout() {
    localStorage.removeItem(AUTH_CONFIG.tokenKey);
    localStorage.removeItem(AUTH_CONFIG.refreshTokenKey);
    localStorage.removeItem(AUTH_CONFIG.userKey);
  }

  getToken(): string | null {
    return localStorage.getItem(AUTH_CONFIG.tokenKey);
  }

  getUser(): User | null {
    const userData = localStorage.getItem(AUTH_CONFIG.userKey);
    return userData ? JSON.parse(userData) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private decodeToken(token: string): User {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const payload = JSON.parse(jsonPayload);
      
      return {
        email: payload.email,
        customerId: payload['custom:customerId'],
        role: payload['custom:role'],
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return { email: '', customerId: '', role: '' };
    }
  }
}

export const authService = new AuthService();
