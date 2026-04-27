import { defaultConfig, createWeb3Modal } from '@web3modal/ethers/react';
import { mainnet, bsc, polygon, arbitrum, optimism, base } from 'viem/chains';

const projectId = import.meta.env.VITE_WEB3_PROJECT_ID;

const isValidWalletConnectProjectId = (value: string | undefined) => {
  // WalletConnect Cloud projectId is a 32-char hex string
  return !!value && /^[a-f0-9]{32}$/i.test(value);
};

if (!isValidWalletConnectProjectId(projectId)) {
  console.error(
    'Invalid or missing VITE_WEB3_PROJECT_ID. Set it to your WalletConnect Cloud projectId (32-char hex) from https://cloud.walletconnect.com'
  );
}

const chains = [mainnet, bsc, polygon, arbitrum, optimism, base] as const;

const ethersConfig = defaultConfig({
  metadata: {
    name: 'PoolTradePlug',
    description: 'Decentralized Trading Pool Platform with Web3 Integration',
    url: typeof window !== 'undefined' ? window.location.origin : '',
    icons: [typeof window !== 'undefined' ? `${window.location.origin}/icons/icon-192.png` : ''],
  },
  enableEIP6963: true,
  enableInjected: true,
  enableCoinbase: true,
  rpcUrl: 'https://cloudflare-eth.com',
  defaultChainId: 1,
});

// Initialize the Web3Modal once at module level (v5 global store pattern)
export const web3modal = createWeb3Modal({
  ethersConfig,
  chains: [mainnet, bsc, polygon, arbitrum, optimism, base],
  // If projectId is invalid, Web3Modal will not be able to establish WalletConnect sessions on mobile.
  // We still pass through the raw env value so it's obvious in runtime logs what was configured.
  projectId: projectId || '',
  enableAnalytics: false,
  allWallets: 'SHOW',
});

export const SUPPORTED_CHAINS = {
  ETHEREUM: 1,
  BSC: 56,
  POLYGON: 137,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BASE: 8453,
};

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  56: 'Binance Smart Chain',
  137: 'Polygon',
  42161: 'Arbitrum One',
  10: 'Optimism',
  8453: 'Base',
};

export const WALLET_TYPES = [
  'metamask',
  'trust-wallet',
  'coinbase',
  'walletconnect',
  'phantom',
  'exodus',
  'safepal',
  'halo',
  'defi-wallet',
  'browser-wallet',
];

export const SUPPORTED_TOKENS = {
  ETH: { symbol: 'ETH', name: 'Ethereum', decimals: 18, chains: [1] },
  USDT: {
    symbol: 'USDT',
    name: 'Tether',
    decimals: 6,
    chains: [1, 56, 137, 42161, 10, 8453],
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chains: [1, 56, 137, 42161, 10, 8453],
  },
  DAI: { symbol: 'DAI', name: 'Dai', decimals: 18, chains: [1, 137, 42161] },
  WBTC: { symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, chains: [1, 137] },
  BNB: { symbol: 'BNB', name: 'Binance Coin', decimals: 18, chains: [56] },
  MATIC: { symbol: 'MATIC', name: 'Polygon', decimals: 18, chains: [137] },
};
