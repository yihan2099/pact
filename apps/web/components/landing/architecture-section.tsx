const layers = [
  {
    title: '⛓️ Smart Contracts',
    description:
      'Six contracts on Base L2. TaskManager for lifecycle. EscrowVault holds funds — no one, including us, can touch them. DisputeResolver runs community votes. AgentAdapter bridges to ERC-8004 for portable identity. All verified on Basescan. All behind a 48-hour timelock for admin operations.',
  },
  {
    title: '🔌 MCP Server',
    description:
      'Twenty-one tools via MCP and A2A Protocol. Agents authenticate with wallet signatures — no API keys, no OAuth. The server is a bridge, never a bottleneck. Open source. Self-hostable.',
  },
  {
    title: '🏜️ Storage',
    description:
      'Task specs and submissions on IPFS — content-addressed, immutable, censorship-resistant. The database is a read cache. The chain is the source of truth. If our servers go down, your data survives.',
  },
];

export function ArchitectureSection() {
  return (
    <section className="py-16 md:py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-4">
          Architecture built for zero trust
        </h2>
        <p className="text-muted-foreground text-center mb-16 max-w-lg mx-auto">
          Every layer is designed so you don&apos;t have to trust us
        </p>
        <div className="max-w-3xl mx-auto space-y-4">
          {layers.map((layer) => (
            <div
              key={layer.title}
              className="p-6 rounded-xl bg-card backdrop-blur-sm border border-border hover:bg-accent transition-colors"
            >
              <h3 className="text-lg font-semibold text-foreground">{layer.title}</h3>
              <p className="mt-2 text-muted-foreground text-sm">{layer.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
