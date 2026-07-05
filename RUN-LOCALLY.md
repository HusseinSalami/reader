# Running the Multi-Tenant Document Platform Locally

## Quick Start

### 1. Start the Frontend

```bash
cd reader/frontend
npm install
npm run dev
```

The app will be available at: **http://localhost:5173**

### 2. Backend (Already Deployed)

The backend is already deployed to AWS and doesn't need to run locally:
- API URL: https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/
- Region: us-east-1
- All Lambda functions are live

## Testing the App

### Register a New Account

1. Open http://localhost:5173
2. You'll be redirected to `/login`
3. Click "Don't have an account? Register here"
4. Fill in the form:
   ```
   Company Name: Test Company
   Email: test@example.com
   First Name: John
   Last Name: Doe
   Password: TestPass123!
   Confirm Password: TestPass123!
   Subscription Tier: Free
   ```
5. Click "Create account"
6. You'll see a success message

### Login

1. On the login page, enter:
   ```
   Email: test@example.com
   Password: TestPass123!
   ```
2. Click "Sign in"
3. You'll be redirected to the dashboard

### Explore the App

- **Dashboard** - View company info and stats
- **Profile** - Edit company profile
- **Upload** - Upload documents (old UI, will be updated in Phase 2)
- **Documents** - View documents (old UI, will be updated in Phase 2)
- **Search** - Search documents (old UI, will be updated in Phase 2)
- **Logout** - Click the logout icon in the top right

## Troubleshooting

### Port Already in Use

If port 5173 is already in use:
```bash
# Kill the process using port 5173
lsof -ti:5173 | xargs kill -9

# Or use a different port
npm run dev -- --port 3000
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
cd reader/frontend
rm -rf node_modules package-lock.json
npm install
```

### API Connection Issues

Check that the API URL in `reader/frontend/src/config.ts` is correct:
```typescript
export const API_URL = 'https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/';
```

### CORS Errors

The backend API has CORS enabled for all origins. If you see CORS errors:
1. Check browser console for the exact error
2. Verify the API URL is correct
3. Check that the backend is deployed

### Authentication Issues

If you can't login:
1. Clear browser localStorage: `localStorage.clear()`
2. Try registering a new account
3. Check browser console for errors
4. Verify the password meets requirements (8+ chars, uppercase, lowercase, number)

## Development Tips

### Hot Reload

The frontend uses Vite with hot module replacement (HMR). Changes to files will automatically reload in the browser.

### Browser DevTools

Open DevTools (F12) to:
- View console logs
- Inspect network requests
- Check localStorage for tokens
- Debug React components

### Check Authentication State

In browser console:
```javascript
// Check if logged in
localStorage.getItem('auth_token')

// View user data
JSON.parse(localStorage.getItem('user_data'))

// Logout
localStorage.clear()
location.reload()
```

### API Testing

Test the backend API directly:
```bash
# Register
curl -X POST https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Company",
    "email": "test2@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "password": "TestPass123!",
    "subscriptionTier": "FREE"
  }'

# Login
curl -X POST https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com",
    "password": "TestPass123!"
  }'
```

## Project Structure

```
reader/
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── services/     # API services
│   │   └── config.ts     # Configuration
│   └── package.json
│
└── backend/              # AWS CDK + Lambda backend
    ├── infrastructure/   # CDK stack definitions
    ├── lambdas/         # Lambda function code
    └── .env             # Environment variables
```

## Environment Variables

### Frontend

Configuration is in `reader/frontend/src/config.ts`:
```typescript
export const API_URL = 'https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/';
```

### Backend

Configuration is in `reader/backend/.env`:
```bash
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=281129374677
STACK_NAME=MultiTenantDocumentPlatformStack
```

## Common Commands

### Frontend
```bash
cd reader/frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run type-check
```

### Backend
```bash
cd reader/backend

# Deploy to AWS
./deploy-multi-tenant.sh

# Test API
cd ..
./test-api.sh
```

## Next Steps

Once you have the app running locally:

1. ✅ Test registration flow
2. ✅ Test login flow
3. ✅ Test dashboard
4. ✅ Test profile management
5. ✅ Test logout

Then you're ready to proceed to Phase 2!

## Need Help?

- Check `PHASE1-UI-TESTING.md` for detailed testing guide
- Check `PASSWORD-IMPLEMENTATION.md` for password details
- Check browser console for errors
- Check CloudWatch logs for backend errors
