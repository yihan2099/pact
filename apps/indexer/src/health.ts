import { getBlockNumber } from '@clawboy/web3-utils';
import { getFailedEventStats } from '@clawboy/database';
import type { EventListener } from './listener';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  currentBlock: number;
  lastProcessedBlock: number;
  lagBlocks: number;
  lagSeconds: number;
  dlqDepth: number;
  lastEventProcessedAt: string | null;
  uptime: number;
  version: string;
}

const BLOCK_TIME_SECONDS = 2; // Base L2 ~2s block time
const DEGRADED_LAG_THRESHOLD = 50;
const UNHEALTHY_LAG_THRESHOLD = 200;
const UNHEALTHY_DLQ_THRESHOLD = 10;

/**
 * Start the health check HTTP server alongside the indexer.
 * Returns a cleanup function to shut down the server.
 */
export function startHealthServer(
  listener: EventListener,
  chainId: number,
  port: number
): { stop: () => void } {
  const startedAt = Date.now();
  let lastEventProcessedAt: Date | null = null;

  // Track when events are processed by wrapping the listener
  const originalOnEvent = listener.onEvent.bind(listener);
  listener.onEvent = (handler) => {
    originalOnEvent(async (event) => {
      await handler(event);
      lastEventProcessedAt = new Date();
    });
  };

  const server = Bun.serve({
    port,
    fetch: async (req) => {
      const url = new URL(req.url);

      if (url.pathname === '/health') {
        return handleHealth(listener, chainId, startedAt, lastEventProcessedAt);
      }

      if (url.pathname === '/ready') {
        return handleReady(listener);
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  console.log(`Health server listening on port ${port}`);

  return {
    stop: () => {
      server.stop();
    },
  };
}

async function handleHealth(
  listener: EventListener,
  chainId: number,
  startedAt: number,
  lastEventProcessedAt: Date | null
): Promise<Response> {
  try {
    const [currentBlock, dlqStats] = await Promise.all([
      getBlockNumber(chainId),
      getFailedEventStats().catch(() => ({
        pending: 0,
        retrying: 0,
        failed: 0,
        resolved: 0,
        total: 0,
      })),
    ]);

    const lastProcessed = listener.getLastProcessedBlock();
    const lagBlocks = Number(currentBlock - lastProcessed);
    const lagSeconds = lagBlocks * BLOCK_TIME_SECONDS;
    const dlqDepth = dlqStats.pending + dlqStats.retrying;
    const uptime = Math.floor((Date.now() - startedAt) / 1000);

    let status: HealthResponse['status'] = 'healthy';
    if (lagBlocks > UNHEALTHY_LAG_THRESHOLD || dlqDepth > UNHEALTHY_DLQ_THRESHOLD) {
      status = 'unhealthy';
    } else if (lagBlocks > DEGRADED_LAG_THRESHOLD) {
      status = 'degraded';
    }

    // If listener isn't running, it's unhealthy
    if (!listener.isRunning()) {
      status = 'unhealthy';
    }

    const body: HealthResponse = {
      status,
      currentBlock: Number(currentBlock),
      lastProcessedBlock: Number(lastProcessed),
      lagBlocks,
      lagSeconds,
      dlqDepth,
      lastEventProcessedAt: lastEventProcessedAt?.toISOString() ?? null,
      uptime,
      version: '0.1.0',
    };

    const httpStatus = status === 'unhealthy' ? 503 : 200;

    return new Response(JSON.stringify(body), {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        error: message,
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        version: '0.1.0',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}

function handleReady(listener: EventListener): Response {
  const ready = listener.hasCompletedInitialSync();

  if (ready) {
    return new Response(JSON.stringify({ ready: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  return new Response(JSON.stringify({ ready: false }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
