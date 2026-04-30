import React, { useEffect, useState } from 'react';
import { useWeb3Modal } from '@web3modal/ethers/react';
// Import web3Config to ensure createWeb3Modal() is called (v5 global store pattern)
import '../lib/web3Config';

export function Web3ModalWrapper({ children }: { children: React.ReactNode }) {
  const { open } = useWeb3Modal();
  const [error, setError] = useState<string | null>(null);

  // Monitor for WalletConnect errors
  useEffect(() => {
    const handleError = (event: Event) => {
      if (event instanceof ErrorEvent) {
        const errorMsg = event.error?.message || event.message;
        if (errorMsg?.includes('Session namespaces')) {
          console.error('WalletConnect Namespace Error:', errorMsg);
          setError('Wallet connection error. Please try another wallet or refresh.');
        }
      }
    };

    window.addEventListener('error', handleError);
    
    // Also handle unhandled rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason);
      if (msg?.includes('Session namespaces')) {
        console.error('WalletConnect Namespace Promise Rejection:', msg);
        setError('Wallet connection error. Please try another wallet.');
        // Clear error after 5 seconds
        setTimeout(() => setError(null), 5000);
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Show error message if connection fails
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-destructive/10 border border-destructive rounded-lg p-6">
          <h2 className="font-semibold text-destructive mb-2">Connection Error</h2>
          <p className="text-sm text-foreground mb-4">{error}</p>
          <button
            onClick={() => setError(null)}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
