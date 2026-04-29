# Wallet Discovery - Deployment Checklist

Use this checklist to verify the wallet discovery system is properly deployed and functioning before going to production.

## ✅ Pre-Deployment (Setup Phase)

### Code Quality
- [ ] All TypeScript files compile without errors
  - Run: `npm run build`
  - Expected: No compile errors
- [ ] All tests pass
  - Run: `npm run test` (if configured)
  - Expected: All tests passing or no tests configured
- [ ] No linting errors
  - Run: `npm run lint` (if configured)
  - Expected: No errors or warnings

### Dependencies
- [ ] All Web3 packages installed
  ```bash
  npm list @web3modal/ethers ethers wagmi viem
  ```
  - Expected: All packages present with correct versions
- [ ] No critical security vulnerabilities
  ```bash
  npm audit
  ```
  - Expected: No critical vulnerabilities (moderate acceptable)

### Environment Configuration
- [ ] `.env` file exists in project root
- [ ] `VITE_SUPABASE_URL` is set
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` is set
- [ ] `VITE_WEB3_PROJECT_ID` is set (or test value in place)
- [ ] `ALCHEMY_API_KEY` is set (or test value in place)

```bash
# Verify environment
grep -E "VITE_SUPABASE|VITE_WEB3|ALCHEMY" .env
```

### Database
- [ ] Database migration applied to Supabase
  ```bash
  npx supabase db push
  ```
  - Expected: "Finished supabase db push" message
- [ ] Tables exist in database
  - `connected_wallets`
  - `wallet_transactions`
  - `wallet_assets`
- [ ] RLS policies enabled on all tables
- [ ] Indexes created for performance

### Edge Functions
- [ ] Edge functions deployed
  ```bash
  npx supabase functions deploy wallet-operations wallet-balance-sync
  ```
  - Expected: "Deployed Functions..." message
- [ ] Function files exist at:
  - `supabase/functions/wallet-operations/index.ts`
  - `supabase/functions/wallet-balance-sync/index.ts`

### Source Files
- [ ] Core discovery file exists
  - `src/lib/walletDiscovery.ts`
- [ ] Enhanced hook exists
  - `src/hooks/useWeb3WalletV2.tsx`
- [ ] Enhanced modal exists
  - `src/components/WalletConnectModalV2.tsx`
- [ ] Web3 config exists
  - `src/lib/web3Config.ts`
- [ ] Web3 Modal Wrapper exists
  - `src/components/Web3ModalWrapper.tsx`
- [ ] Dashboard page exists
  - `src/pages/dashboard/Web3WalletPage.tsx`

### Documentation
- [ ] All 6 documentation files present
  - [ ] WALLET_DISCOVERY_QUICK_REFERENCE.md
  - [ ] WALLET_DISCOVERY_SYSTEM.md
  - [ ] WALLET_DISCOVERY_IMPLEMENTATION.md
  - [ ] WALLET_DISCOVERY_EXAMPLES.md
  - [ ] WALLET_DISCOVERY_GUIDE.md
  - [ ] WALLET_DISCOVERY_INDEX.md

## 🧪 Desktop Testing

### Development Server
- [ ] Start dev server
  ```bash
  npm run dev
  ```
  - Expected: Server running at `http://localhost:5173`
- [ ] No console errors on page load
  - Check browser DevTools console
  - Expected: No red errors
- [ ] Page loads without timeout
  - Expected: Page loads in < 3 seconds

### Wallet Detection
- [ ] Install MetaMask extension (if on Chrome)
- [ ] Check wallet auto-detection
  ```javascript
  // In browser console
  import { walletDiscoveryService } from '@/lib/walletDiscovery';
  const wallets = await walletDiscoveryService.discoverWallets();
  console.table(wallets);
  ```
  - Expected: MetaMask shows in list with `installed: true`
- [ ] Try another installed wallet (if available)
- [ ] Verify WalletConnect fallback always available

### UI Components
- [ ] Navigate to wallet page (if exists)
  - URL: `http://localhost:5173/dashboard/web3-wallet`
  - Expected: Page loads without errors
- [ ] Connect wallet button visible and clickable
- [ ] Wallet modal opens when button clicked
- [ ] Multiple wallet options visible in modal
- [ ] WalletConnect option visible as fallback

### Connection Flow
- [ ] Click on detected wallet in modal
- [ ] Web3Modal opens (or wallet app opens)
- [ ] Complete connection flow
- [ ] User address displays after connection
- [ ] Wallet shows as connected in UI

### Performance
- [ ] Wallet detection completes in < 200ms
  ```javascript
  const start = performance.now();
  const wallets = await walletDiscoveryService.discoverWallets();
  console.log(`Detection took: ${performance.now() - start}ms`);
  ```
  - Expected: < 200ms
- [ ] Cached results return in < 5ms on second call
- [ ] No memory leaks (check DevTools memory tab)

### Error Scenarios
- [ ] No wallet extensions installed → WalletConnect shows
- [ ] Wallet connection denied → Error message shows
- [ ] Network error → Graceful fallback works
- [ ] Wrong network → Network switch prompt shows

## 📱 Mobile Testing (Android)

### Setup
- [ ] Chrome DevTools device emulation enabled
  - DevTools → ⋮ → More tools → Device emulation
- [ ] Or: Physical Android device with Chrome installed
- [ ] Navigate to `http://localhost:5173` (or ngrok URL)

### Platform Detection
- [ ] Platform detected as Android
  ```javascript
  console.log({
    isMobile: walletDiscoveryService.isMobile(),
    isAndroid: walletDiscoveryService.isAndroid(),
    isIOS: walletDiscoveryService.isIOS(),
  });
  ```
  - Expected: `isMobile: true, isAndroid: true, isIOS: false`

### Wallet Detection (Android)
- [ ] MetaMask app shows in wallet list
- [ ] Trust Wallet app shows (if installed)
- [ ] Phantom app shows (if installed)
- [ ] All show `type: 'mobile'`

### Mobile Wallet Connection
- [ ] Click on mobile wallet in modal
- [ ] App store link shows if wallet not installed
- [ ] Deep link attempts if wallet installed
- [ ] WalletConnect QR code shows as fallback
- [ ] Connection completes successfully

### In-App Browser Detection
- [ ] Open MetaMask app
- [ ] Go to Browser → Navigate to your app
- [ ] Platform detected as Android
- [ ] MetaMask option disabled (using native browser instead)
- [ ] WalletConnect available as option

### Performance (Mobile)
- [ ] Page loads quickly on mobile device
- [ ] Wallet detection completes in < 500ms
- [ ] Tap responses immediate (no lag)
- [ ] Connection flow smooth

## 📱 Mobile Testing (iOS)

### Setup
- [ ] Safari or Chrome on iOS device
- [ ] Or: Xcode iOS simulator
- [ ] Navigate to app URL

### Platform Detection
- [ ] Platform detected as iOS
  ```javascript
  console.log({
    isMobile: walletDiscoveryService.isMobile(),
    isAndroid: walletDiscoveryService.isAndroid(),
    isIOS: walletDiscoveryService.isIOS(),
  });
  ```
  - Expected: `isMobile: true, isAndroid: false, isIOS: true`

### Wallet Detection (iOS)
- [ ] MetaMask app shows in wallet list
- [ ] Trust Wallet app shows (if installed)
- [ ] Phantom app shows (if installed)
- [ ] All show `type: 'mobile'`

### Mobile Wallet Connection
- [ ] Click on mobile wallet in modal
- [ ] App Store link shows if wallet not installed
- [ ] Universal link attempts if wallet installed
- [ ] WalletConnect QR code shows as fallback
- [ ] Connection completes successfully

### In-App Browser Detection
- [ ] Open MetaMask iOS app
- [ ] Go to Browser → Navigate to your app
- [ ] Platform detected as iOS
- [ ] MetaMask option disabled (using native browser)
- [ ] WalletConnect available as option

## 🌐 Cross-Browser Testing

### Chrome/Chromium
- [ ] Wallet detection works
- [ ] Connection successful
- [ ] No console errors

### Firefox
- [ ] Wallet detection works (if extension installed)
- [ ] Connection successful
- [ ] No console errors

### Safari (Desktop)
- [ ] WalletConnect fallback works
- [ ] Connection via WalletConnect successful

### Edge
- [ ] Same as Chrome (Chromium-based)

## 🔐 Security Verification

### Signature Verification
- [ ] Connected wallet signature stored in database
- [ ] Message signed shows in UI
- [ ] Wallet verified status shows as true
- [ ] User can only see their own wallets (RLS)

### Database Security
- [ ] RLS policies enabled on all tables
- [ ] Try to query another user's wallets
  ```sql
  SELECT * FROM connected_wallets WHERE user_id != current_user_id;
  ```
  - Expected: Empty result set (RLS blocks it)

### Environment Secrets
- [ ] No private keys in `.env` file
- [ ] No sensitive data in localStorage
- [ ] No secrets in source code
- [ ] `.env` not committed to git

## 📊 Analytics & Logging

### Event Tracking
- [ ] Wallet connection events logged
- [ ] Platform distribution tracked
- [ ] Error events captured
- [ ] Performance metrics collected

### Error Logging
- [ ] Connection errors logged
- [ ] Deep link failures logged
- [ ] Network errors logged
- [ ] Browser console errors checked

## 🚀 Production Readiness

### Credentials Update
- [ ] Update `VITE_WEB3_PROJECT_ID` with real WalletConnect ID
  - Get from: https://cloud.walletconnect.com
- [ ] Update `ALCHEMY_API_KEY` with real Alchemy key
  - Get from: https://www.alchemy.com
- [ ] Verify credentials in `.env`
- [ ] Test with production credentials

### Build Optimization
- [ ] Production build creates successfully
  ```bash
  npm run build
  ```
  - Expected: Build folder created with optimized assets
- [ ] Build size reasonable (< 50MB)
- [ ] No console warnings in production build

### Deployment
- [ ] Deploy to staging environment
- [ ] Run all tests on staging
- [ ] Test on staging device(s)
- [ ] Get stakeholder approval
- [ ] Deploy to production
- [ ] Monitor for errors post-deployment

## 📋 Final Verification

### Feature Completeness
- [ ] Wallet auto-discovery working
- [ ] Desktop extension detection working
- [ ] Mobile deep links working
- [ ] WalletConnect fallback working
- [ ] Database persistence working
- [ ] Multi-wallet support working
- [ ] Primary wallet setting working
- [ ] Wallet disconnection working

### User Experience
- [ ] Onboarding smooth and intuitive
- [ ] Error messages clear and helpful
- [ ] Loading states visible
- [ ] Success feedback provided
- [ ] Mobile experience optimized
- [ ] Accessibility checked (WCAG 2.1)

### Performance
- [ ] Page load time < 3 seconds
- [ ] Wallet detection < 200ms
- [ ] Connection < 5 seconds
- [ ] No jank or freezing
- [ ] Memory usage stable

### Documentation
- [ ] All guides complete and accurate
- [ ] Code examples tested and working
- [ ] API reference up-to-date
- [ ] Troubleshooting guide helpful
- [ ] Quick reference accessible

## 🐛 Known Issues & Workarounds

### Issue: Wallets Not Detected
**Status**: Investigate  
**Workaround**: Use WalletConnect fallback  
**Resolution**: Check wallet extension installation

### Issue: Mobile Deep Links Fail
**Status**: Expected on emulator  
**Workaround**: WalletConnect fallback  
**Resolution**: Test on physical device

### Issue: EIP6963 Not Working
**Status**: Some wallets don't support yet  
**Workaround**: Standard detection methods used  
**Resolution**: Wallet team update needed

## 📞 Support Contacts

- **Wallet Issues**: Check wallet provider documentation
- **Web3Modal**: https://docs.walletconnect.com/appkit/overview
- **Supabase**: https://supabase.com/docs
- **Network Issues**: Use Alchemy dashboard for diagnostics

## ✍️ Sign-Off

- [ ] Code reviewed and approved
- [ ] Tests passing and verified
- [ ] Documentation complete and accurate
- [ ] Security review passed
- [ ] Performance benchmarks met
- [ ] Product manager approval
- [ ] Ready for production deployment

**Date**: _______________  
**Tested By**: _______________  
**Approved By**: _______________  

## 📌 Post-Deployment Monitoring

### First 24 Hours
- [ ] Monitor error logs
- [ ] Check connection success rate (target: > 95%)
- [ ] Monitor performance metrics
- [ ] User support tickets reviewed
- [ ] No critical issues reported

### First Week
- [ ] Success rate stable
- [ ] Performance stable
- [ ] User feedback collected
- [ ] Analytics reviewed
- [ ] Any issues documented

### Ongoing
- [ ] Weekly error rate review
- [ ] Monthly performance report
- [ ] Quarterly security audit
- [ ] Regular user feedback collection
- [ ] Update documentation as needed

---

**System Status**: ✅ Ready for Testing and Deployment

**Next Steps**:
1. Complete all checklists
2. Fix any failing items
3. Get stakeholder sign-off
4. Deploy to production
5. Monitor for 24 hours
6. If all good, mark as complete

**Questions?** Refer to [WALLET_DISCOVERY_GUIDE.md](./WALLET_DISCOVERY_GUIDE.md) or reach out to the development team.
