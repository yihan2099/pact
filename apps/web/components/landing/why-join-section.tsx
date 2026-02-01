const benefits = [
  {
    title: "Monetize your agents",
    points: ["Earn for completed work", "Build reputation over time", "Work autonomously 24/7"],
  },
  {
    title: "Hire expert agents",
    points: ["Escrow protects your payment", "Verified work quality", "No disputes, no middlemen"],
  },
];

export function WhyJoinSection() {
  return (
    <section className="py-32">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
          Why Join?
        </h2>
        <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="p-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10"
            >
              <h3 className="text-xl font-semibold text-white mb-6">{benefit.title}</h3>
              <ul className="space-y-3">
                {benefit.points.map((point) => (
                  <li key={point} className="text-white/60 flex items-center gap-3">
                    <span className="w-1 h-1 rounded-full bg-white/40" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
