import { mock } from 'bun:test';

/**
 * Create a chainable mock Supabase query builder.
 * Each method records calls and returns `this` for chaining.
 * Terminal methods (single, maybeSingle, then) return configurable { data, error }.
 */
export function createMockQueryBuilder(
  data: any = null,
  error: any = null,
  count: number | null = null
) {
  const builder: any = {
    select: mock((..._args: any[]) => builder),
    insert: mock((..._args: any[]) => builder),
    update: mock((..._args: any[]) => builder),
    delete: mock((..._args: any[]) => builder),
    upsert: mock((..._args: any[]) => builder),
    eq: mock((..._args: any[]) => builder),
    neq: mock((..._args: any[]) => builder),
    gt: mock((..._args: any[]) => builder),
    gte: mock((..._args: any[]) => builder),
    lt: mock((..._args: any[]) => builder),
    lte: mock((..._args: any[]) => builder),
    in: mock((..._args: any[]) => builder),
    not: mock((..._args: any[]) => builder),
    overlaps: mock((..._args: any[]) => builder),
    order: mock((..._args: any[]) => builder),
    range: mock((..._args: any[]) => builder),
    limit: mock((..._args: any[]) => builder),
    single: mock(() => Promise.resolve({ data, error })),
    maybeSingle: mock(() => Promise.resolve({ data, error })),
    then: (resolve: Function) => resolve({ data, error, count }),
  };
  return builder;
}

/**
 * Create a mock Supabase client with `.from()` and `.rpc()` methods.
 */
export function createMockSupabaseClient() {
  let currentBuilder: any = createMockQueryBuilder();
  let rpcHandler: (...args: any[]) => Promise<{ data: any; error: any }> = () =>
    Promise.resolve({ data: null, error: null });

  const mockFrom = mock((..._args: any[]) => currentBuilder);
  const mockRpc = mock((...args: any[]) => rpcHandler(...args));

  const client = {
    from: mockFrom,
    rpc: mockRpc,
  };

  return {
    client,
    mockFrom,
    mockRpc,
    /** Set the query builder returned by .from() */
    setBuilder(builder: any) {
      currentBuilder = builder;
      mockFrom.mockImplementation(() => builder);
    },
    /** Set the RPC handler */
    setRpcHandler(handler: (...args: any[]) => Promise<{ data: any; error: any }>) {
      rpcHandler = handler;
      mockRpc.mockImplementation(handler);
    },
    /** Reset all mocks */
    reset() {
      mockFrom.mockClear();
      mockRpc.mockClear();
      currentBuilder = createMockQueryBuilder();
      mockFrom.mockImplementation(() => currentBuilder);
      rpcHandler = () => Promise.resolve({ data: null, error: null });
      mockRpc.mockImplementation(rpcHandler);
    },
  };
}

/**
 * Setup the @supabase/supabase-js mock. Must be called BEFORE importing any modules.
 * Returns controls for the mock client.
 */
export function setupSupabaseMock() {
  const supabaseMock = createMockSupabaseClient();

  mock.module('@supabase/supabase-js', () => ({
    createClient: mock(() => supabaseMock.client),
  }));

  return supabaseMock;
}
