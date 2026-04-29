# Wallet Integration - Quick Start & Testing Guide

## 🚀 Quick Deployment

### Prerequisites
- Node.js / Bun installed
- Supabase CLI installed (`npm install -g supabase`)
- Access to Supabase project
- Private keys for pool wallets (Ethereum, BSC, Polygon, Arbitrum)

### Step-by-Step Deployment

#### 1. Set Supabase Environment Variables
Go to Supabase Dashboard > Project Settings > Vault > Add new secret

```
POOL_WALLET_PRIVATE_KEY_1=0x... (Ethereum mainnet)
POOL_WALLET_PRIVATE_KEY_56=0x... (BSC mainnet)
POOL_WALLET_PRIVATE_KEY_137=0x... (Polygon mainnet)
POOL_WALLET_PRIVATE_KEY_42161=0x... (Arbitrum mainnet)
ALCHEMY_API_KEY=your-alchemy-key (optional)
```

#### 2. Run Migrations
```bash
cd supabase
supabase db pull  # Pull current schema
supabase db push  # Push new migrations
```

#### 3. Deploy Functions
```bash
# Deploy individual functions
supabase functions deploy wallet-sweep-operations
supabase functions deploy admin-wallet-management

# Or use the deployment script
bash deploy-wallet-fixes.sh
```

#### 4. Update Frontend Code
The code is already updated in:
- `src/lib/walletDetection.ts` - Enhanced wallet detection
- `src/hooks/useWeb3Wallet.tsx` - Enhanced connection hook

Verify:
```bash
grep -l "performHandshake\|performComprehensiveDetection" src/hooks/useWeb3Wallet.tsx
```

## 🧪 Testing Checklist

### Test 1: Wallet Detection

**In Browser Console:**
```javascript
// Import detection utility
import { performComprehensiveDetection, detectInstalledWallets } from '@/lib/walletDetection';

// Check what wallets are available
const detection = performComprehensiveDetection();
console.log('Installed wallets:', detection.installed);
console.log('Available wallets:', detection.available);
console.log('Mobile device:', detection.isMobile);
console.log('Detected wallet type:', detection.walletType);
```

**Expected Output:**
```
Installed wallets: [{ id: 'metamask', name: 'MetaMask', isInstalled: true, ... }]
Available wallets: [{ id: 'metamask', ... }, { id: 'walletconnect', ... }]
Mobile device: false
Detected wallet type: 'metamask'
```

### Test 2: Wallet Connection

**Step-by-step:**
1. Open application
2. Click "Connect Wallet" button
3. Select wallet (MetaMask/Trust/Phantom)
4. Approve connection in wallet extension/app
5. Sign the verification message
6. Wait for handshake to complete

**Verify in Database:**
```sql
-- Check wallet was created
SELECT id, wallet_address, wallet_type, verified, handshake_status 
FROM connected_wallets 
WHERE user_id = 'your-user-id'
ORDER BY connected_at DESC 
LIMIT 1;

-- Expected result:
-- id: uuid
-- wallet_address: 0x...
-- wallet_type: 'metamask'
-- verified: true
-- handshake_status: 'completed'
```

**Verify in UI:**
- Wallet should appear in "Connected Wallets" section
- Status badge should show "Verified"
- Primary wallet should be automatically set

### Test 3: Sweep Eligibility

**Check Sweep Requirements:**
```javascript
// In browser console
const { useWallet } = await import('@/hooks/useWeb3Wallet');
const { connectedWallets } = useWallet();
const wallet = connectedWallets[0];

// Check if sweep-ready
console.log('Verified:', wallet.verified);
console.log('Allowance:', wallet.allowance_amount);
console.log('Active:', wallet.is_active);

// Make API call to check eligibility
fetch('/functions/v1/wallet-sweep-operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'check_eligibility',
    userId: 'your-user-id',
    walletId: 'wallet-id',
    poolId: 'pool-id'
  })
})
.then(r => r.json())
.then(data => console.log('Sweep eligibility:', data));
```

**Verify in Database:**
```sql
-- Check sweep eligibility
SELECT user_id, wallet_id, is_eligible, eligible_amount, reasons
FROM sweep_eligibility 
WHERE user_id = 'your-user-id'
ORDER BY last_checked DESC;

-- Check sweep history
SELECT amount_swept, currency, sweep_status, transaction_hash
FROM sweep_history 
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 5;
```

### Test 4: Admin Wallet Management

**Test Admin Function:**
```javascript
// Get admin token
const token = localStorage.getItem('sb-auth-token');

// List wallets for user
fetch('/functions/v1/admin-wallet-management', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    action: 'list_user_wallets',
    userId: 'target-user-id'
  })
})
.then(r => r.json())
.then(data => console.log('User wallets:', data));

// Get wallet stats
fetch('/functions/v1/admin-wallet-management', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    action: 'get_wallet_stats',
    userId: 'target-user-id'
  })
})
.then(r => r.json())
.then(data => console.log('Wallet stats:', data));
```

**Verify Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "user-uuid",
    "wallets": [
      {
        "id": "wallet-uuid",
        "wallet_address": "0x...",
        "wallet_type": "metamask",
        "verified": true,
        "handshake_status": "completed",
        "allowance_amount": 1000,
        "is_active": true
      }
    ],
    "total": 1
  }
}
```

## 🔍 Detailed Test Scenarios

### Scenario 1: First-Time User
```
1. User opens app
2. System detects installed wallets ✅
3. User clicks "Connect Wallet" ✅
4. Wallet modal shows detected wallets ✅
5. User selects MetaMask ✅
6. MetaMask extension opens ✅
7. User confirms connection ✅
8. App requests message signature ✅
9. User signs message ✅
10. Handshake performs ✅
11. Wallet appears in list as verified ✅
12. User can see allowance amount ✅
```

### Scenario 2: Sweep Transaction
```
1. User has verified wallet with allowance > 0 ✅
2. Pool is open for deposits ✅
3. User initiates sweep ✅
4. Eligibility checked ✅
5. Transaction prepared ✅
6. Gas estimated ✅
7. Transaction sent ✅
8. Transaction confirmed ✅
9. Pool auto-join (if enabled) ✅
10. Notification created ✅
11. History recorded in database ✅
```

### Scenario 3: Mobile User
```
1. User on mobile with Phantom installed ✅
2. App detects mobile device ✅
3. Available wallets includes Phantom ✅
4. User clicks Phantom wallet ✅
5. Deep link opens Phantom app ✅
6. Connection completed in Phantom ✅
7. Returns to app with connected wallet ✅
```

## 📊 Monitoring & Debugging

### Check Function Logs
```bash
# Real-time logs
supabase functions logs wallet-sweep-operations

# Or for admin function
supabase functions logs admin-wallet-management
```

### Database Queries for Debugging

**Check Wallet Connection Timeline:**
```sql
SELECT 
  user_id,
  wallet_address,
  wallet_type,
  handshake_status,
  handshake_timestamp,
  created_at,
  verified_at
FROM connected_wallets
WHERE user_id = 'target-user-id'
ORDER BY created_at DESC;
```

**Check Wallet Activity:**
```sql
SELECT 
  activity_type,
  created_at,
  details
FROM wallet_activity
WHERE user_id = 'target-user-id'
ORDER BY created_at DESC
LIMIT 20;
```

**Check Sweep History:**
```sql
SELECT 
  sweep_status,
  amount_swept,
  currency,
  transaction_hash,
  error_message,
  created_at
FROM sweep_history
WHERE user_id = 'target-user-id'
ORDER BY created_at DESC
LIMIT 10;
```

**Check Connection Errors:**
```sql
SELECT 
  wallet_address,
  wallet_type,
  connection_status,
  error_message,
  created_at,
  metadata
FROM wallet_connection_logs
WHERE user_id = 'target-user-id'
AND connection_status = 'failed'
ORDER BY created_at DESC;
```

## ⚠️ Common Issues & Solutions

### Issue: Wallet Not Detected
**Diagnosis:**
```javascript
const ethereum = window.ethereum;
console.log('Ethereum provider:', ethereum);
console.log('Is MetaMask:', ethereum?.isMetaMask);
```

**Solutions:**
- Clear browser cache and reload
- Disable browser extensions and re-enable
- Ensure wallet extension is installed
- Try different wallet (for testing)

### Issue: Handshake Fails
**Diagnosis:**
```sql
SELECT * FROM wallet_connection_logs
WHERE connection_status = 'failed'
ORDER BY created_at DESC
LIMIT 5;
```

**Solutions:**
- Check Supabase function logs
- Verify private keys are set in Supabase Vault
- Check network connectivity
- Verify chain ID is supported

### Issue: Sweep Transaction Fails
**Diagnosis:**
```sql
SELECT error_message FROM sweep_history
WHERE sweep_status = 'failed'
ORDER BY created_at DESC;
```

**Solutions:**
- Verify token address is correct for chain
- Check wallet has sufficient balance
- Verify allowance is granted
- Check gas price on chain
- Verify RPC endpoint is responsive

### Issue: Admin Function Returns 401
**Diagnosis:**
```javascript
import { jwtDecode } from 'jwt-decode';
const token = localStorage.getItem('sb-auth-token');
const decoded = jwtDecode(token);
console.log('Role:', decoded.role);
console.log('Email:', decoded.email);
```

**Solutions:**
- Ensure user is admin in auth system
- Check email ends with @pooltrader.admin or has admin role
- Verify token is not expired
- Re-authenticate if needed

## 📈 Performance Tips

1. **Batch Sweeps**: Perform multiple sweeps in single transaction
2. **Cache Eligibility**: Results cached for 1 hour
3. **Optimize Gas**: Use Alchemy RPC for better estimates
4. **Monitor History**: Archive old records (> 90 days)
5. **Rate Limit**: Implement per-user rate limiting

## 🔐 Security Best Practices

✅ Always store private keys in Supabase Vault, never in code
✅ Verify admin role on backend, not frontend
✅ Use JWT tokens for function authentication
✅ Implement RLS policies on all tables
✅ Add nonce to each message signature
✅ Log all admin actions
✅ Monitor for suspicious activity

## 📞 Support

If you encounter issues:

1. Check the logs:
   ```bash
   supabase functions logs wallet-sweep-operations
   supabase functions logs admin-wallet-management
   ```

2. Query the database:
   ```sql
   -- Check latest errors
   SELECT * FROM wallet_connection_logs WHERE connection_status = 'failed' ORDER BY created_at DESC LIMIT 10;
   ```

3. Review documentation:
   - [WALLET_DEPLOYMENT_GUIDE.md](./WALLET_DEPLOYMENT_GUIDE.md)
   - [WEB3_SETUP_GUIDE.md](./WEB3_SETUP_GUIDE.md)

4. Check browser console for client-side errors

## ✅ Deployment Checklist

- [ ] Supabase environment variables set
- [ ] Migrations deployed successfully
- [ ] Functions deployed and enabled
- [ ] Frontend code updated
- [ ] Wallet detection tested
- [ ] Connection flow tested
- [ ] Handshake completes successfully
- [ ] Admin functions work with proper auth
- [ ] Sweep transactions execute
- [ ] Database records created correctly
- [ ] Logs show no errors
- [ ] UI displays wallet information correctly
- [ ] Mobile wallet deep links work
- [ ] RLS policies verified
- [ ] Performance acceptable

## 🎉 Success Indicators

✅ Wallets detected automatically
✅ Connection completes with handshake
✅ Wallets appear in UI immediately
✅ Handshake status transitions from pending → completed
✅ Sweep eligibility checked correctly
✅ Sweep transactions succeed
✅ Admin can query wallet data
✅ No errors in function logs
✅ Database records accurate
✅ Mobile wallet support working
