// Multi-Tenant Document Platform Configuration
export const API_URL = 'https://bslwuuodji.execute-api.us-east-1.amazonaws.com/prod/';

export const config = {
  apiUrl: API_URL,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedFormats: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/tiff',
  ],
};

// Auth configuration
export const AUTH_CONFIG = {
  tokenKey: 'auth_token',
  refreshTokenKey: 'refresh_token',
  userKey: 'user_data',
};
