import { DashboardNav } from '@/components/dashboard-nav';
import { Web3Provider } from '@/components/web3-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Provider>
      <div className="relative min-h-screen min-h-[100dvh]">
        <div className="fixed inset-0 bg-background" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,var(--gradient-glow),transparent_60%)]" />
        </div>
        <DashboardNav />
        <main className="relative z-10 container mx-auto px-4 py-6">{children}</main>
      </div>
    </Web3Provider>
  );
}
