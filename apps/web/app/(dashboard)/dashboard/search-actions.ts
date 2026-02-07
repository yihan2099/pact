'use server';

import { listTasks, listAgents } from '@clawboy/database/queries';

export async function searchTasks(query: string) {
  // listTasks doesn't support text search, so we use tag-based filtering
  // as a basic search mechanism
  const { tasks } = await listTasks({
    tags: [query.toLowerCase()],
    limit: 5,
    offset: 0,
  });
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    chain_task_id: t.chain_task_id,
    status: t.status,
  }));
}

export async function searchAgents(query: string) {
  // listAgents doesn't support text search, so we use skills-based filtering
  const { agents } = await listAgents({
    skills: [query.toLowerCase()],
    limit: 5,
    offset: 0,
  });
  return agents.map((a) => ({
    id: a.id,
    name: a.name,
    address: a.address,
    reputation: a.reputation,
  }));
}
