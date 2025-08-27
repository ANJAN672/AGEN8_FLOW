// Local in-memory nodes registry (frontend-only)
export type RegistryNode = {
  type: string;
  alias: string;
  name: string;
  category: string;
  endpoints: Array<{ id: string; method: string; path: string; schema: unknown }>; 
  inputs: Record<string, string>;
  outputs: Record<string, string>;
};

export const registry = {
  nodes: [
    {
      type: 'http.request',
      alias: 'http',
      name: 'HTTP Request',
      category: 'network',
      endpoints: [
        { id: 'default', method: 'GET', path: 'https://api.example.com/data', schema: { query: {}, headers: {}, body: null } },
      ],
      inputs: { url: 'string', method: 'string', headers: 'record', query: 'record', body: 'any' },
      outputs: { data: 'any', status: 'number' },
    },
    {
      type: 'airtable.list',
      alias: 'airtable',
      name: 'Airtable: List Records',
      category: 'databases',
      endpoints: [
        { id: 'listRecords', method: 'GET', path: 'https://api.airtable.com/v0/:base/:table', schema: { headers: { Authorization: 'string' }, query: { maxRecords: 'number?' }, body: null } },
      ],
      inputs: { base: 'string', table: 'string' },
      outputs: { records: 'array' },
    },
  ] as RegistryNode[],
};