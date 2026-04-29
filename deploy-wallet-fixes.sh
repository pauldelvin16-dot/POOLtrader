#!/bin/bash

# Wallet Integration Deployment Script
# This script deploys all wallet fixes to Supabase

set -e

echo "🚀 Starting Wallet Integration Deployment"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check environment
echo -e "${YELLOW}📋 Checking environment...${NC}"

if [ -z "$SUPABASE_PROJECT_ID" ]; then
    echo -e "${RED}❌ Error: SUPABASE_PROJECT_ID not set${NC}"
    exit 1
fi

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ Error: SUPABASE_ACCESS_TOKEN not set${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables OK${NC}"

# Step 1: Deploy Migrations
echo ""
echo -e "${YELLOW}📦 Deploying Migrations...${NC}"

# Push migration 1: Enhanced wallet tracking
echo "  → Deploying enhanced_wallet_tracking..."
supabase migration up 20260428000001_enhanced_wallet_tracking

# Push migration 2: Sweep enhancements
echo "  → Deploying sweep_enhancements..."
supabase migration up 20260428000002_sweep_enhancements

echo -e "${GREEN}✅ Migrations deployed${NC}"

# Step 2: Deploy Supabase Functions
echo ""
echo -e "${YELLOW}🔧 Deploying Supabase Functions...${NC}"

# Deploy wallet-sweep-operations
echo "  → Deploying wallet-sweep-operations..."
supabase functions deploy wallet-sweep-operations --no-verify

# Deploy admin-wallet-management
echo "  → Deploying admin-wallet-management..."
supabase functions deploy admin-wallet-management --no-verify

echo -e "${GREEN}✅ Functions deployed${NC}"

# Step 3: Set Environment Variables
echo ""
echo -e "${YELLOW}🔐 Setting Environment Variables...${NC}"

# These should be set in Supabase Dashboard > Settings > Vault
# For now, just remind the user
echo -e "${YELLOW}⚠️  IMPORTANT: Set these environment variables in Supabase Dashboard:${NC}"
echo "  - POOL_WALLET_PRIVATE_KEY (fallback)"
echo "  - POOL_WALLET_PRIVATE_KEY_1 (Ethereum)"
echo "  - POOL_WALLET_PRIVATE_KEY_56 (BSC)"
echo "  - POOL_WALLET_PRIVATE_KEY_137 (Polygon)"
echo "  - POOL_WALLET_PRIVATE_KEY_42161 (Arbitrum)"
echo "  - ALCHEMY_API_KEY (optional, for RPC failover)"

# Step 4: Verify Deployment
echo ""
echo -e "${YELLOW}✔️  Verifying Deployment...${NC}"

echo "  → Checking functions..."
supabase functions list

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "📝 Next Steps:"
echo "  1. Verify all functions are deployed and enabled"
echo "  2. Set environment variables in Supabase Dashboard"
echo "  3. Test wallet detection: npm run test:wallets"
echo "  4. Test sweep functionality: npm run test:sweep"
echo "  5. Monitor logs: supabase functions delete-logs && supabase functions logs"
echo ""
echo "📚 Documentation: See WALLET_DEPLOYMENT_GUIDE.md"
echo ""
