import { defaultConfig, createWeb3Modal } from '@web3modal/ethers/react';
import { mainnet, bsc, polygon, arbitrum, optimism, base } from 'viem/chains';

const projectId = import.meta.env.VITE_WEB3_PROJECT_ID;

const isValidWalletConnectProjectId = (value: string | undefined) => {
  // WalletConnect Cloud projectId is a 32-char hex string or allow test IDs
  return !!value && (value.length > 0);
};

if (!isValidWalletConnectProjectId(projectId)) {
  console.warn(
    'Missing VITE_WEB3_PROJECT_ID. Get it from https://cloud.walletconnect.com. Using fallback mode.'
  );
}

const chains = [mainnet, bsc, polygon, arbitrum, optimism, base] as const;

const ethersConfig = defaultConfig({
  metadata: {
    name: 'PoolTradePlug',
    description: 'Decentralized Trading Pool Platform with Web3 Integration',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://poo-ltradeplug.vercel.app',
    icons: [typeof window !== 'undefined' ? `${window.location.origin}/icons/icon-192.png` : 'https://poo-ltradeplug.vercel.app/icons/icon-192.png'],
  },
  enableEIP6963: true,
  enableInjected: true,
  enableCoinbase: true,
  rpcUrl: 'https://eth.publicnode.com',
  defaultChainId: 1,
});

// Initialize the Web3Modal once at module level (v5 global store pattern)
// WalletConnect v2 requires proper namespace configuration
export const web3modal = createWeb3Modal({
  ethersConfig,
  chains: [mainnet, bsc, polygon, arbitrum, optimism, base],
  projectId: projectId || '18394b23745a7af92638a70d73f5628f', // Fallback project ID
  enableAnalytics: false,
  allWallets: 'SHOW',
  themeMode: 'light',
  featuredWalletIds: [
    'c02aef614-3f2e-46b3-ab2e-1f0ac78a5f60', // MetaMask
    'fd20dc426fb0deb8c9244ef4aac44546', // SafePal
    '4622a2b2d6af1c9844944291e5eee59e', // Trust
  ],
});

export const SUPPORTED_CHAINS = {
  ETHEREUM: 1,
  BSC: 56,
  POLYGON: 137,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BASE: 8453,
  SOLANA: 101, // Solana mainnet
  SOLANA_DEVNET: 103,
  SOLANA_TESTNET: 102,
};

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  56: 'Binance Smart Chain',
  137: 'Polygon',
  42161: 'Arbitrum One',
  10: 'Optimism',
  8453: 'Base',
  101: 'Solana',
  102: 'Solana Testnet',
  103: 'Solana Devnet',
};

// Solana-specific chain identifiers (non-EVM)
export const SOLANA_CHAIN_IDS = {
  MAINNET: 'solana:5eykt4UsFv8P8NJdReREHVaFAvdWg27pQneHWaSM8Gr',
  TESTNET: 'solana:4uhcVJyU9pJkvHySbaKMtXLD4o4a7rdS8hcFisbZoB5m',
  DEVNET: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1QcWGzyHuwiq2',
};

// RPC endpoints for all chains including Solana
export const RPC_ENDPOINTS: Record<number | string, string> = {
  1: 'https://cloudflare-eth.com',
  56: 'https://bsc-dataseed.binance.org/',
  137: 'https://polygon-rpc.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  10: 'https://mainnet.optimism.io',
  8453: 'https://mainnet.base.org',
  // Solana RPC endpoints
  101: 'https://api.mainnet-beta.solana.com',
  102: 'https://api.testnet.solana.com',
  103: 'https://api.devnet.solana.com',
};

// Alchemy RPC endpoints (when API key is available)
export const getAlchemyRpcUrl = (chainId: number, alchemyKey: string): string | null => {
  const endpoints: Record<number, string> = {
    1: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    137: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    42161: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    10: `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    8453: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  };
  return endpoints[chainId] || null;
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
  // Solana tokens
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    chains: [101, 102, 103],
    isNative: true,
  },
  'USDC-SOL': {
    symbol: 'USDC',
    name: 'USD Coin (Solana)',
    decimals: 6,
    chains: [101, 102, 103],
    contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
  },
  'USDT-SOL': {
    symbol: 'USDT',
    name: 'Tether (Solana)',
    decimals: 6,
    chains: [101, 102, 103],
    contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // Mainnet USDT
  },
  BONK: {
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    chains: [101],
    contractAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  },
  JUP: {
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    chains: [101],
    contractAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  },
};

// Solana wallet detection helpers
export const isSolanaChain = (chainId: number | string): boolean => {
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
  return id === 101 || id === 102 || id === 103;
};

export const getSolanaChainName = (chainId: number): string => {
  const names: Record<number, string> = {
    101: 'mainnet-beta',
    102: 'testnet',
    103: 'devnet',
  };
  return names[chainId] || 'mainnet-beta';
};

// Detect if user has Solana wallets installed
export const detectSolanaWallets = (): { name: string; installed: boolean; deepLink?: string }[] => {
  const wallets = [
    { name: 'Phantom', key: 'phantom', deepLink: 'https://phantom.app/ul/browse/{url}' },
    { name: 'Solflare', key: 'solflare', deepLink: 'https://solflare.com/ul/browse/{url}' },
    { name: 'Glow', key: 'glow', deepLink: 'https://glow.app/ul/browse/{url}' },
    { name: 'Backpack', key: 'backpack', deepLink: 'https://backpack.app/ul/browse/{url}' },
  ];

  return wallets.map((w) => ({
    name: w.name,
    installed: typeof window !== 'undefined' && !!(window as any)[w.key]?.solana,
    deepLink: w.deepLink,
  }));
};

// Check if Phantom wallet is available
export const isPhantomAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).phantom?.solana;
};

// Get Solana RPC endpoint with optional custom endpoint
export const getSolanaRpcUrl = (chainId: number = 101, customUrl?: string): string => {
  if (customUrl) return customUrl;
  return RPC_ENDPOINTS[chainId] || RPC_ENDPOINTS[101];
};
