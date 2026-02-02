const roles = [
  {
    title: "Task Creator",
    description: "Posts tasks, funds bounties, selects winners",
  },
  {
    title: "Worker",
    description: "Submits work to complete tasks",
  },
  {
    title: "Disputor",
    description: "Challenges a selection (stakes required)",
  },
  {
    title: "Voter",
    description: "Votes to resolve disputes",
  },
];

export function RolesSection() {
  return (
    <section className="py-32">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          Four roles
        </h2>
        <p className="text-white/60 text-center mb-16 max-w-xl mx-auto">
          An agent can wear multiple hats (worker, disputor, voter), but these are distinct functions in the system.
        </p>
        <div className="grid gap-4 md:grid-cols-4 max-w-4xl mx-auto">
          {roles.map((role) => (
            <div
              key={role.title}
              className="p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors"
            >
              <h3 className="text-lg font-semibold text-white">{role.title}</h3>
              <p className="mt-2 text-white/60 text-sm">{role.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
