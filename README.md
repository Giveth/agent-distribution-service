# Ethereum Wallet Service

A TypeScript service for managing Ethereum wallets with PostgreSQL database integration. This service provides functionality to generate and manage Ethereum wallets using HD (Hierarchical Deterministic) paths.

## Features

- Generate Ethereum wallets with HD paths
- Store wallet information in PostgreSQL
- RESTful API endpoints for wallet management
- Docker support for easy deployment
- TypeORM for database management
- Environment-based configuration

## Prerequisites

- Node.js (v14 or higher)
- Docker and Docker Compose
- PostgreSQL (if running without Docker)

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

3. Create a `.env` file in the root directory:
```env
# Ethereum Configuration
SEED_PHRASE="your seed phrase here"
RPC_URL="your ethereum rpc url"

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

4. Start the PostgreSQL database:
```bash
docker-compose up -d
```

5. Build and start the application:
```bash
npm run build
npm start
```

## API Endpoints

### Generate a new wallet
```bash
POST /api/wallet/generate
Content-Type: application/json

{
    "index": 0
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
```bash
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

## Development

1. Start the development server with hot reload:
```bash
npm run dev
```

2. Run tests:
```bash
npm test
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