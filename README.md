# Gmail PDF Fund Processor

This Node.js script automates the processing of fund price data from Gmail attachments. It reads emails with PDF attachments, extracts fund pricing information using OpenAI, and saves the data to Firebase Firestore.

## Features

- 🔐 **Secure Authentication**: Uses environment variables for all credentials
- 📧 **Gmail Integration**: Automatically fetches the latest emails with PDF attachments
- 🤖 **AI-Powered Extraction**: Uses OpenAI to extract structured fund data from PDFs
- 🔥 **Firebase Storage**: Saves data to Firestore with both historical records and current prices
- 📊 **Comprehensive Logging**: Detailed console output for monitoring and debugging

## Architecture

```
Gmail → PDF Download → OpenAI Processing → Firebase Storage
  ↓           ↓              ↓                 ↓
Email API   Base64 PDF    Fund Data       priceUnits/
                         Extraction       funds/
```

## Data Flow

1. **Email Processing**: Fetches the most recent email from Gmail
2. **PDF Extraction**: Downloads and converts PDF attachments to base64
3. **AI Analysis**: Uses OpenAI to extract fund data (idFund, date, price)
4. **Firebase Storage**: 
   - Saves historical data to `priceUnits/{idFund}/historical/{date}`
   - Updates current price in `funds/{idFund}.unit`

## Prerequisites

- Node.js 16+
- Gmail API credentials
- OpenAI API key
- Firebase Admin SDK credentials
- Firebase project with Firestore enabled

## Installation

1. **Clone and install dependencies**:
```bash
npm install
```

2. **Create environment file**:
```bash
cp .env.example .env
```

3. **Configure environment variables** (see Configuration section)

## Configuration

Create a `.env` file with the following variables:

### OpenAI Configuration
```env
OPENAI_API_KEY=sk-proj-your-openai-api-key
```

### Firebase Configuration
```env
DATABASE_ID=your-firestore-database-id
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-private-key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robotics/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com
```

### Google OAuth2 Configuration
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_PROJECT_ID=your-google-project
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost

# OAuth2 Tokens (generated after authentication)
ACCESS_TOKEN_KEY=ya29.your-access-token
REFRESH_TOKEN_KEY=1//your-refresh-token
SCOPE_KEY=https://www.googleapis.com/auth/gmail.readonly
TOKEN_TYPE_KEY=Bearer
EXPIRY_DATE_KEY=1751583587486
```

## Usage

### Run the Complete Process
```bash
node run-gmail-processor.js
```

This will:
1. Authenticate with Gmail
2. Fetch the latest email with PDF attachments
3. Process PDFs with OpenAI
4. Save data to Firebase

### Run Individual Components

**Process Gmail only**:
```bash
node gmail-processor.js
```

**Process with OpenAI only**:
```bash
node openai-processor.js [pdf-file-path]
```

**Save to Firebase only**:
```bash
node save-firebase.js
```

## Firebase Data Structure

### Historical Data
```
priceUnits/
├── {idFund}/
│   └── historical/
│       └── {date}/
│           ├── date: "2024-01-15"
│           └── price: 1234.56
```

### Current Prices
```
funds/
├── {idFund}/
│   ├── unit: 1234.56  (updated by script)
│   └── ... (other fund fields)
```

## Expected Data Format

The script expects PDFs to contain fund data that OpenAI can extract in this format:

```json
[
  {
    "idFund": "FUND001",
    "date": "2024-01-15", 
    "price": 1234.56
  },
  {
    "idFund": "FUND002",
    "date": "2024-01-15",
    "price": 2345.67
  }
]
```

## Error Handling

- **Authentication Errors**: Automatically cleans malformed tokens
- **Missing Data**: Skips incomplete fund records with warnings
- **Firebase Errors**: Continues processing other funds if one fails
- **API Rate Limits**: Includes retry logic for OpenAI requests

## Logging

The script provides detailed logging:

- 🔥 Firebase initialization
- 📧 Gmail authentication and email processing  
- 🤖 OpenAI PDF analysis
- ✅ Successful data saves
- ⚠️ Warnings for incomplete data
- ❌ Error details with context

## Security Notes

- All credentials stored in environment variables
- `.env` files excluded from git via `.gitignore`
- No sensitive data logged to console
- Uses Firebase Admin SDK for secure database access

## Troubleshooting

### Common Issues

**Invalid Grant Error**:
- Check OAuth2 tokens for extra quotes or commas
- Regenerate tokens if expired

**Firebase Permission Error**:
- Verify service account has Firestore write permissions
- Check Firebase project ID matches configuration

**OpenAI API Error**:
- Verify API key is valid and has credits
- Check PDF file size limits

**Gmail API Error**:
- Ensure Gmail API is enabled in Google Console
- Check OAuth2 scopes include gmail.readonly

## Dependencies

```json
{
  "dotenv": "^16.4.5",
  "firebase-admin": "latest",
  "googleapis": "latest", 
  "openai": "latest"
}
```

## License

MIT License - See LICENSE file for details 