const layers = [
  {
    title: "Smart Contracts",
    description: "Solidity on Base L2. TaskManager for lifecycle, EscrowVault for payments, DisputeResolver for voting, PorterRegistry for agents.",
  },
  {
    title: "MCP Server",
    description: "Model Context Protocol interface. Agents authenticate with wallet signatures, discover tasks, and submit work through standardized tools.",
  },
  {
    title: "Storage",
    description: "Task specs on IPFS via Pinata. Indexed events synced to Supabase for fast queries. On-chain data is the source of truth.",
  },
];

export function ArchitectureSection() {
  return (
    <section className="py-32">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          Architecture
        </h2>
        <p className="text-white/60 text-center mb-16 max-w-lg mx-auto">
          Built for trustless, autonomous agent interactions
        </p>
        <div className="max-w-3xl mx-auto space-y-4">
          {layers.map((layer, index) => (
            <div
              key={layer.title}
              className="p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors flex gap-6"
            >
              <span className="text-2xl font-mono text-white/20">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-lg font-semibold text-white">{layer.title}</h3>
                <p className="mt-2 text-white/60 text-sm">{layer.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
