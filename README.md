# FundDistributer - Ethereum Wallet Service with Gas Sponsorship

A TypeScript service for managing Ethereum wallets with PostgreSQL database integration and Gelato gas sponsorship. This service provides functionality to generate and manage Ethereum wallets using HD (Hierarchical Deterministic) paths, with all transactions sponsored by default.

## Features

- Generate Ethereum wallets with HD paths
- Store wallet information in PostgreSQL
- Gelato gas sponsorship for all transactions
- Automatic fund distribution with calculations
- Donation Handler Contract Integration - Uses specialized contract for secure donations
- Batch Donation Support - Efficiently distribute funds to multiple recipients in a single transaction
- Automatic Approval Management - Handles ERC-20 token approvals for the donation handler
- RESTful API endpoints for wallet management
- Docker support for easy deployment
- TypeORM for database management
- Environment-based configuration

## Prerequisites

- Node.js (v14 or higher)
- Docker and Docker Compose
- PostgreSQL (if running without Docker)
- Gelato Sponsor API Key (for gas sponsorship)

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd <repository-name>
```

2. Install dependencies:
```bash
npm install
```

3. Get a Gelato Sponsor API Key:
   - Visit [Gelato App](https://app.gelato.network/)
   - Navigate to the Relay section
   - Create a new app
   - Select Polygon network (chain ID: 137)
   - Copy the generated Sponsor API Key

4. Create a `.env` file in the root directory:
```env
# Ethereum Configuration
SEED_PHRASE="your seed phrase here"
RPC_URL="https://polygon-rpc.com"
CHAIN_ID=137

# Gelato Configuration
GELATO_SPONSOR_API_KEY="your_gelato_sponsor_api_key_here"
GELATO_SPONSOR_URL="https://relay.gelato.digital"
GELATO_CHAIN_ID=137

# Blockchain Configuration
TOKEN_ADDRESS="0xc7B1807822160a8C5b6c9EaF5C584aAD0972deeC"
DONATION_HANDLER_ADDRESS="0x6e349c56f512cb4250276bf36335c8dd618944a1"

# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=wallet_db
```

5. Start the PostgreSQL database:
```bash
docker-compose up -d
```

6. Build and start the application:
```bash
npm run build
npm start
```

## API Endpoints

### Generate a new wallet
```http
POST /api/wallet/generate
Content-Type: application/json

{
  "index": 0  // optional, defaults to next available index
}
```

Response:
```json
{
  "address": "0x...",
  "hdPath": "m/44'/60'/0'/0/0"
}
```

### Get all wallets
```http
GET /api/wallet/wallets
```

Response:
```json
[
  {
    "address": "0x...",
    "hdPath": "m/44'/60'/0'/0/0"
  },
  {
    "address": "0x...",
    "hdPath": "m/44'/60'/0'/0/1"
  }
]
```

### Distribute funds from a wallet
```http
POST /api/wallet/distribute-funds
Content-Type: application/json

{
  "walletAddress": "0x...",
  "projects": [
    {
      "name": "Project Alpha",
      "slug": "project-alpha",
      "walletAddress": "0x1234567890123456789012345678901234567890",
      "score": 85
    },
    {
      "name": "Project Beta", 
      "slug": "project-beta",
      "walletAddress": "0x0987654321098765432109876543210987654321",
      "score": 65
    }
  ]
}
```

Response:
```json
{
  "walletAddress": "0x...",
  "totalBalance": "1000.0",
  "distributedAmount": "1000.0",
  "transactions": [
    {
      "to": "0x1234567890123456789012345678901234567890",
      "amount": "566.67",
      "taskId": "gelato_task_id_1",
      "transactionHash": "0x..."
    },
    {
      "to": "0x0987654321098765432109876543210987654321",
      "amount": "433.33",
      "taskId": "gelato_task_id_2",
      "transactionHash": "0x..."
    }
  ],
  "summary": {
    "totalRecipients": 2,
    "totalTransactions": 0,
    "successCount": 0,
    "failureCount": 0
  },
  "projectsDistributionDetails": [
    {
      "project": {
        "name": "Project Alpha",
        "slug": "project-alpha", 
        "walletAddress": "0x1234567890123456789012345678901234567890",
        "score": 85
      },
      "amount": "566.67"
    },
    {
      "project": {
        "name": "Project Beta",
        "slug": "project-beta",
        "walletAddress": "0x0987654321098765432109876543210987654321", 
        "score": 65
      },
      "amount": "433.33"
    }
  ]
}
```

## How It Works

### 1. Wallet Generation
When a new wallet is generated for a cause:
- The wallet is created using HD derivation from the seed phrase
- The HD path is stored in the database (e.g., "m/44'/60'/0'/0/0")
- All future transactions from this wallet will be sponsored

### 2. Fund Distribution
When you call the distribute-funds endpoint:
- The system checks the wallet's current token balance
- Calculates distribution amounts based on project scores
- Automatically approves the donation handler contract if needed
- Sends batch donations through the donation handler contract for efficiency
- Returns detailed results with transaction hashes and distribution details

### 3. Score-Based Distribution
The system distributes funds proportionally based on project scores:
- Calculates total score sum across all projects
- Each project receives: `(project_score / total_score) * total_balance`
- All transactions are automatically sponsored by Gelato

### 4. Gas Sponsorship
All transactions are automatically sponsored by Gelato:
- Approval Transactions: ERC-20 token approvals are sponsored
- Donation Transactions: All donation transactions are sponsored
- No POL balance required in the sender's wallet
- Gas fees are covered by your Gelato sponsor account
- Transactions are executed on Polygon network
- Automatic retry and error handling

### 5. Donation Handler Contract
The system uses a specialized donation handler contract for secure and efficient donations:
- **Contract Address**: `0x6e349c56f512cb4250276bf36335c8dd618944a1` (Polygon)
- **Batch Donations**: Distribute to multiple recipients in a single transaction
- **Infinite Approvals**: Uses infinite approval for maximum efficiency
- **Automatic Approvals**: Handles ERC-20 token approvals automatically
- **Enhanced Security**: Uses dedicated contract for donation logic
- **Gas Efficiency**: Reduces gas costs through batch processing and infinite approvals

## Benefits

1. **Seamless Onboarding**: New causes can start distributing immediately without needing POL
2. **Uninterrupted Operations**: Existing causes won't be blocked by insufficient gas
3. **Cost Predictability**: Gas costs are sponsored and predictable
4. **Better UX**: Users don't need to manage native tokens
5. **Score-Based Distribution**: Fair distribution based on project scores
6. **ERC-20 Token Support**: Distributes specific tokens, not just native currency

## Development

1. Start the development server with hot reload:
```bash
npm run dev
```

2. Run tests:
```bash
npm test
```

3. Run specific test suites:
```bash
npm run test:services
npm run test:repositories
```

## Database Migrations

The project uses TypeORM migrations for database schema management. Migrations are automatically run when the application starts.

To create a new migration:
```bash
npm run typeorm migration:create src/migrations/MigrationName
```

To run migrations manually:
```bash
npm run typeorm migration:run
```

To revert migrations:
```bash
npm run typeorm migration:revert
```

## Security Considerations

- The seed phrase is stored in environment variables and should be kept secure
- Database credentials should be properly managed
- In production, set `NODE_ENV=production` to disable development features
- Consider using a reverse proxy and SSL in production

## License

ISC 