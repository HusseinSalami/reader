# Document Reader Frontend

React-based frontend application for document scanning and digitization.

## Features

- Drag-and-drop document upload
- Real-time processing status
- Document list with filtering
- Full-text search
- Extracted text viewer
- Metadata and data inspection
- Download original documents

## Prerequisites

- Node.js 18+ and npm
- Backend API deployed and running

## Installation

```bash
cd reader/frontend
npm install
```

## Configuration

Update the API URL in `src/config.ts`:

```typescript
export const API_URL = 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod';
```

Or set environment variable:
```bash
export VITE_API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
```

## Development

Start development server:
```bash
npm run dev
```

Open http://localhost:3000

## Build

Create production build:
```bash
npm run build
```

Output in `dist/` directory.

## Deployment Options

### Option 1: AWS Amplify

1. Push code to GitHub/GitLab/Bitbucket
2. Connect repository to AWS Amplify
3. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add environment variable: `VITE_API_URL`
5. Deploy

### Option 2: Amazon S3 + CloudFront

```bash
# Build the app
npm run build

# Create S3 bucket
aws s3 mb s3://document-reader-frontend

# Enable static website hosting
aws s3 website s3://document-reader-frontend --index-document index.html

# Upload files
aws s3 sync dist/ s3://document-reader-frontend --acl public-read

# Create CloudFront distribution (optional, for HTTPS and CDN)
```

### Option 3: Docker

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Usage

### Upload Document

1. Navigate to Upload page
2. Drag and drop file or click to browse
3. Supported formats: PDF, PNG, JPG, TIFF
4. Wait for upload confirmation
5. View processing status

### View Documents

1. Navigate to Documents page
2. Filter by status (All, Completed, Processing, etc.)
3. Click document to view details

### Search Documents

1. Navigate to Search page
2. Enter search terms
3. View matching documents
4. Click to view full document

### Document Detail

- View extracted text
- Inspect metadata (dates, emails, phones)
- View extracted data (key-value pairs, tables)
- Download original document

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── Layout.tsx          # Main layout with navigation
│   ├── pages/
│   │   ├── Home.tsx            # Landing page
│   │   ├── Upload.tsx          # Document upload
│   │   ├── Documents.tsx       # Document list
│   │   ├── DocumentDetail.tsx  # Document viewer
│   │   └── Search.tsx          # Search interface
│   ├── services/
│   │   └── api.ts              # API client
│   ├── App.tsx                 # Main app component
│   ├── config.ts               # Configuration
│   ├── index.css               # Global styles
│   └── main.tsx                # Entry point
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Customization

### Styling

Modify inline styles in components or add CSS modules for more complex styling.

### File Size Limit

Update in `src/config.ts`:
```typescript
maxFileSize: 10 * 1024 * 1024, // 10MB
```

### Supported Formats

Update in `src/config.ts`:
```typescript
supportedFormats: [
  'application/pdf',
  'image/png',
  'image/jpeg',
  // Add more formats
],
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Performance

- Code splitting with React Router
- Lazy loading for better initial load
- Optimized bundle size with Vite

## Troubleshooting

**Issue**: CORS errors
- **Solution**: Ensure backend API has CORS enabled for your domain

**Issue**: Upload fails
- **Solution**: Check file size and format, verify API URL in config

**Issue**: Documents not loading
- **Solution**: Verify API endpoint is accessible, check browser console for errors
