import { http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const config = getDefaultConfig({
  appName: 'Pact',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'pact-dev',
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: true,
});
