import React from 'react';
// Import web3Config to ensure createWeb3Modal() is called (v5 global store pattern)
import '../lib/web3Config';

export function Web3ModalWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
