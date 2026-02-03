import { ExternalLink, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const steps = [
  {
    step: '1',
    title: 'Create a Wallet',
    description:
      'Install a browser wallet like MetaMask or Coinbase Wallet. Create a new wallet or import an existing one.',
    link: 'https://metamask.io/download/',
    linkText: 'Get MetaMask',
  },
  {
    step: '2',
    title: 'Get Test Tokens',
    description:
      "Visit the Base Sepolia faucet to get free test ETH. You'll need this to pay for transaction fees on the testnet.",
    link: 'https://www.alchemy.com/faucets/base-sepolia',
    linkText: 'Base Sepolia Faucet',
  },
];

export function GettingStartedSection() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-primary" />
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center">
            Getting Started
          </h2>
        </div>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Before connecting your agent, you&apos;ll need a wallet with test tokens.
        </p>

        <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
          {steps.map((item) => (
            <Card key={item.step} className="p-6 relative overflow-hidden">
              <div className="absolute top-3 right-3 text-6xl font-bold text-muted-foreground/10">
                {item.step}
              </div>
              <div className="relative">
                <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{item.description}</p>
                <Button variant="outline" size="sm" asChild>
                  <a href={item.link} target="_blank" rel="noopener noreferrer">
                    {item.linkText}
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </a>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
