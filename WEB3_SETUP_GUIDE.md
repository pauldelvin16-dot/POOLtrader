# Web3 Wallet Integration Setup Guide

## Overview
PoolTradePlug now includes mandatory Web3 wallet connectivity with support for:
- MetaMask
- Trust Wallet
- Wallet Connect (supports 300+ wallets)
- Phantom Wallet
- Exodus
- SafePal
- Halo Wallet
- DeFi Wallet

## Prerequisites

1. **WalletConnect Project ID** (Free)
   - Go to https://cloud.walletconnect.com
   - Sign up or log in
   - Create a new project
   - Copy your Project ID

2. **Alchemy API Key** (for balance syncing)
   - Go to https://www.alchemy.com
   - Create an account
   - Create a new app
   - Copy your API key

3. **Supported Blockchain Networks**
   - Ethereum (Mainnet)
   - Binance Smart Chain (BSC)
   - Polygon
   - Arbitrum One
   - Optimism
   - Base

## Configuration Steps

### 1. Update Environment Variables

Edit `.env` file and add:

```env
# Web3 Configuration
VITE_WEB3_PROJECT_ID="your_walletconnect_project_id_here"
ALCHEMY_API_KEY="your_alchemy_api_key_here"
```

### 2. Install Dependencies

```bash
bun install
# or
npm install
```

### 3. Deploy Supabase Edge Functions

```bash
# Make sure you're logged in to Supabase
npx supabase login

# Link your project (if not already done)
npx supabase link --project-ref ptbjhkhkkhdkvuiyxibd

# Deploy edge functions
npx supabase functions deploy wallet-operations
npx supabase functions deploy wallet-balance-sync
```

### 4. Run Database Migrations

```bash
# Push migrations to Supabase
npx supabase db push
```

This will create:
- `connected_wallets` table
- `wallet_transactions` table
- `wallet_assets` table
- Related Row Level Security (RLS) policies

## Usage

### For Users

1. **Connect Wallet**
   - Click "Connect Wallet" in the dashboard
   - Select your wallet type (MetaMask, WalletConnect, etc.)
   - Sign the verification message
   - Wallet is now connected and verified

2. **Manage Wallets**
   - View all connected wallets
   - Set a primary wallet
   - Disconnect wallets
   - Copy wallet addresses

3. **View Assets**
   - See token balances across all chains
   - Track USD value
   - View transaction history

### For Developers

#### Using the Wallet Hook

```typescript
import { useWallet } from '@/hooks/useWeb3Wallet';

function MyComponent() {
  const {
    connectedWallets,
    primaryWallet,
    connectWallet,
    disconnectWallet,
    setPrimaryWallet,
    provider,
    signer,
  } = useWallet();

  return (
    // Your component
  );
}
```

#### Using Web3 Provider

```typescript
import { useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react';
import { BrowserProvider } from 'ethers';

function MyComponent() {
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();

  if (walletProvider) {
    const provider = new BrowserProvider(walletProvider);
    const signer = await provider.getSigner();
  }
}
```

## Database Schema

### connected_wallets
```sql
- id (UUID)
- user_id (UUID) - FK to profiles
- wallet_address (VARCHAR)
- wallet_type (VARCHAR) - e.g., 'metamask', 'walletconnect'
- chain_id (INTEGER) - Blockchain network ID
- is_primary (BOOLEAN)
- verified (BOOLEAN)
- signature (VARCHAR) - For ownership verification
- connected_at (TIMESTAMP)
- last_used_at (TIMESTAMP)
```

### wallet_transactions
```sql
- id (UUID)
- user_id (UUID) - FK to profiles
- wallet_id (UUID) - FK to connected_wallets
- tx_hash (VARCHAR) - Transaction hash
- tx_type (VARCHAR) - 'deposit', 'withdrawal', 'transfer'
- amount (NUMERIC)
- currency (VARCHAR) - 'ETH', 'USDT', etc.
- status (VARCHAR) - 'pending', 'confirmed', 'failed'
- chain_id (INTEGER)
```

### wallet_assets
```sql
- id (UUID)
- user_id (UUID)
- wallet_id (UUID)
- contract_address (VARCHAR)
- token_symbol (VARCHAR)
- token_name (VARCHAR)
- balance (NUMERIC)
- balance_usd (NUMERIC)
- chain_id (INTEGER)
```

## Edge Functions

### wallet-operations
- **Endpoint**: `/wallet-operations`
- **Actions**:
  - `verify_wallet` - Verify wallet ownership
  - `update_wallet_balance` - Update balance information
  - `get_wallet_transactions` - Fetch transaction history
  - `record_transaction` - Record a new transaction

### wallet-balance-sync
- **Endpoint**: `/wallet-balance-sync`
- **Actions**:
  - `sync_balance` - Sync wallet balance from RPC
  - `sync_all_wallets` - Sync all user wallets

## Security

1. **Row Level Security (RLS)**
   - Users can only view their own wallets
   - Users can only modify their own wallets
   - Transactions are scoped to user_id

2. **Wallet Verification**
   - Signatures are stored for verification
   - Only verified wallets can be used for transactions

3. **Message Signing**
   - Users sign a message to prove wallet ownership
   - No private keys are shared

## Troubleshooting

### "Cannot find WalletConnect project ID"
- Make sure `VITE_WEB3_PROJECT_ID` is set in `.env`
- Verify it's a valid WalletConnect Cloud project ID

### "RPC endpoint failed"
- Check that `ALCHEMY_API_KEY` is set and valid
- Verify the chain ID is supported

### "Wallet connection fails"
- Ensure your browser supports Web3 (Chrome, Firefox, Safari, Edge)
- Check that the wallet extension is installed
- Try refreshing the page

### "Database migrations fail"
- Run `npx supabase link --project-ref ptbjhkhkkhdkvuiyxibd`
- Ensure you're logged in: `npx supabase login`
- Check migration file syntax

## API Reference

### WalletProvider Context

```typescript
interface WalletContextType {
  connectedWallets: ConnectedWallet[];
  primaryWallet: ConnectedWallet | null;
  isConnecting: boolean;
  error: string | null;
  connectWallet(walletType: string): Promise<void>;
  disconnectWallet(walletId: string): Promise<void>;
  setPrimaryWallet(walletId: string): Promise<void>;
  verifyWallet(walletId: string): Promise<boolean>;
  fetchConnectedWallets(): Promise<void>;
  provider: BrowserProvider | null;
  signer: any;
}
```

## Next Steps

1. Get WalletConnect Project ID from https://cloud.walletconnect.com
2. Update `.env` with your credentials
3. Run `npm install` to install dependencies
4. Deploy edge functions
5. Run database migrations
6. Test wallet connection in the dashboard

## Support

For issues or questions:
- Check the Web3Modal docs: https://docs.walletconnect.com
- Ethers.js documentation: https://docs.ethers.org
- Supabase Edge Functions: https://supabase.com/docs/guides/functions

## References

- [Web3Modal v5](https://docs.walletconnect.com/appkit/overview)
- [Ethers.js v6](https://docs.ethers.org/v6/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [WalletConnect Cloud](https://cloud.walletconnect.com)
