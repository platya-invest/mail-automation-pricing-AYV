# Gmail PDF Fund Processor

This Node.js script automates the processing of fund price and profitability data by consuming an external REST API, applying specific business rules, and saving the extracted information to Firebase Firestore.

## Features

- Secure Authentication: Retrieves a JWT Bearer Token from the authentication endpoint.
- Client Certificates (mTLS): Uses .crt and .key files to establish a secure, mutual TLS connection with the API.
- REST API Integration: Fetches comprehensive fund profitability data (price units, various returns).
- Business Logic Layer: Implements specific mapping rules for fund IDs (numeric to internal UUID) and conditional profitability formatting (e.g., Fund 43, Fund 50 rules).
- Firebase Storage: Saves data to Firestore with both historical records and current prices, including profitability metrics.
- Comprehensive Logging: Detailed console output for monitoring and debugging.

## Architecture

```
External Auth API → JWT Bearer Token
       ↓               ↓
External Data API ← Client Certificates (mTLS)
       ↓               ↓
Fund Data (JSON) → Internal Mapping Layer (UUID, Business Rules)
                   (api-processor.js)
                         ↓
                   Firebase Storage
```

## Data Flow

1. **API Consumption**: Calls the data endpoint (GetProfitabilityByFund) for configured funds, using mTLS and the JWT.
2. **Data Processing & Mapping:**: Maps the API's numeric Fund ID to the internal UUID, Applies conditional logic (e.g., using rentabilidad180 for Fund 43, special status for Fund 50), and formats the profitability value as a percentage string (e.g., "19.76% E.A. Últimos 6 meses").
3. **Firebase Storage**:
   - Saves historical data to `priceUnits/{idFund}/historical/{date}`
   - Updates current price in `funds/{idFund}.unit`
   - Updates current profitability in `funds/{idFund}.targetIncome`

## Prerequisites

- Node.js 16+
- AcVa API credentials and certificates
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

### AcVa API Configuration

```env
API_BASE_URL=https://apifondosmpf.accivalores.com
AUTH_PASSWORD=xxxxxxx
AUTH_CODIGO_APP=xxxxxxx

CLIENT_CERT_PATH=.../apifondosmpf.crt
CLIENT_KEY_PATH=.../mpfinvest.key
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

## Usage

### Run the Complete Process

```bash
node run-api-processor.js
```

This will:

1. Fetch the Fund Data
2. Process and mappind data
3. Save data to Firebase

### Run Individual Components

**Process API only**:

```bash
node api-processor.js
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
│   └── targetIncome (updated by script)
```

## Expected Data Format

The script expects to contain fund data in this format:

```json
[
  {
    "idFund": "FUND001",
    "date": "2024-01-15",
    "price": 1234.56,
    "targetIncome": 19.96,
    "formattedTargetIncome": "19.96% E.A. Último año"
  },
  {
    "idFund": "FUND002",
    "date": "2024-01-15",
    "price": 2345.67,
    "targetIncome": 7.96,
    "formattedTargetIncome": "7.96% E.A. Último año"
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

**Firebase Permission Error**:

- Verify service account has Firestore write permissions
- Check Firebase project ID matches configuration

## Dependencies

```json
{
  "axios": "^1.13.2",
  "dotenv": "^16.4.5",
  "firebase-admin": "latest",
  "googleapis": "latest",
  "openai": "latest"
}
```

## License

MIT License - See LICENSE file for details
