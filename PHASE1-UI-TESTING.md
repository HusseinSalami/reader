# Phase 1 UI Testing Guide

## Quick Start

### 1. Start the Frontend Development Server

```bash
cd reader/frontend
npm install
npm run dev
```

The frontend will be available at: http://localhost:5173

### 2. Test Registration Flow

1. Navigate to http://localhost:5173
2. You'll be redirected to `/login`
3. Click "Don't have an account? Register here"
4. Fill in the registration form:
   - Company Name: Test Company
   - Email: admin@testcompany.com
   - First Name: John
   - Last Name: Doe
   - Password: TestPassword123!
   - Confirm Password: TestPassword123!
   - Subscription Tier: Free (or Pro/Enterprise)
5. Click "Create account"
6. You should see a success message and be redirected to login

### 3. Test Login Flow

1. On the login page, enter:
   - Email: admin@testcompany.com
   - Password: TestPassword123!
2. Click "Sign in"
3. You should be redirected to the dashboard

**No more AWS CLI password setup needed!** Users set their own password during registration.

### 4. Test Dashboard

After successful login, you should see:
- Company information card
- Subscription tier badge
- Usage limits
- Quick action buttons
- Coming soon features

### 5. Test Profile Management

1. Click the user icon in the top right
2. Or navigate to `/profile`
3. Update company information:
   - Company Name
   - Email
   - Phone (optional)
   - Address (optional)
4. Click "Save Changes"
5. Verify the success message
6. Go back to dashboard to see updated info

### 6. Test Navigation

- Click "Dashboard" - should show dashboard
- Click "Upload" - should show upload page (old UI for now)
- Click "Documents" - should show documents list (old UI for now)
- Click "Search" - should show search page (old UI for now)

### 7. Test Logout

1. Click the logout icon (door with arrow) in the top right
2. You should be redirected to `/login`
3. Try accessing `/dashboard` directly - should redirect to login

### 8. Test Protected Routes

1. Logout if logged in
2. Try to access these URLs directly:
   - http://localhost:5173/dashboard
   - http://localhost:5173/profile
   - http://localhost:5173/upload
3. All should redirect to `/login`

## API Endpoints Being Used

### Registration
```
POST https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/auth/register
Body: {
  "companyName": "Test Company",
  "email": "admin@testcompany.com",
  "firstName": "John",
  "lastName": "Doe",
  "password": "TestPassword123!",
  "subscriptionTier": "FREE"
}
```

### Login
```
POST https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/auth/login
Body: {
  "email": "admin@testcompany.com",
  "password": "TestPassword123!"
}
```

### Get Profile
```
GET https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/v1/customers/me
Headers: {
  "Authorization": "Bearer <token>"
}
```

### Update Profile
```
PUT https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/v1/customers/me
Headers: {
  "Authorization": "Bearer <token>"
}
Body: {
  "companyName": "Updated Company Name",
  "contactInfo": {
    "email": "newemail@company.com",
    "phone": "+1234567890",
    "address": "123 Main St"
  }
}
```

## Troubleshooting

### Issue: Password validation error
**Solution**: 
- Password must be at least 8 characters
- Must contain uppercase, lowercase, and number
- Passwords must match in both fields

### Issue: "Email already registered" error
**Solution**: 
- Email is already in use
- Try a different email
- Or delete the user from Cognito console if testing

### Issue: "Not authenticated" error
**Solution**: 
1. Check if the token is stored in localStorage
2. Open browser DevTools > Application > Local Storage
3. Look for `auth_token` key
4. If missing, login again

### Issue: API returns 401 Unauthorized
**Solution**:
1. Check if the token is expired (1 hour expiration)
2. Login again to get a new token
3. Check CloudWatch logs for authorizer errors

### Issue: CORS errors
**Solution**:
1. Make sure the API Gateway has CORS enabled
2. Check the API URL in `frontend/src/config.ts`
3. Verify the backend is deployed

### Issue: Profile update doesn't work
**Solution**:
1. Check browser console for errors
2. Verify the token is valid
3. Check CloudWatch logs for Lambda errors
4. Verify DynamoDB table permissions

## Browser DevTools Tips

### Check Authentication State
```javascript
// In browser console
localStorage.getItem('auth_token')
localStorage.getItem('user_data')
```

### Decode JWT Token
```javascript
// In browser console
const token = localStorage.getItem('auth_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
```

### Clear Authentication
```javascript
// In browser console
localStorage.clear();
location.reload();
```

## Next Steps

After verifying Phase 1 UI works:

1. ✅ Registration flow works
2. ✅ Login flow works
3. ✅ Dashboard displays correctly
4. ✅ Profile management works
5. ✅ Navigation works
6. ✅ Logout works
7. ✅ Protected routes work

**Ready to proceed to Phase 2!** 🚀

Phase 2 will add:
- Document Type Management UI
- Template Builder UI
- Document Upload with processing
- Review Queue UI
