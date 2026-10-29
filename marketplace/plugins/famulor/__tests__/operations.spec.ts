import { QueryError, validateUrlForSSRF } from '@tooljet-marketplace/common';
import got from 'got';
import Famulor from '../lib';
import { QueryOptions, SourceOptions } from '../lib/types';

jest.mock('got', () => {
  const fn = jest.fn();
  return { __esModule: true, default: fn };
});

jest.mock('@tooljet-marketplace/common', () => {
  const actual = jest.requireActual('@tooljet-marketplace/common');
  return {
    ...actual,
    validateUrlForSSRF: jest.fn().mockResolvedValue(undefined),
  };
});

const gotMock = got as unknown as jest.Mock;
const validateMock = validateUrlForSSRF as unknown as jest.Mock;

const KEY = 'fam_test_fixture';
const source: SourceOptions = { api_key: KEY };
const HOST = 'https://app.famulor.io/api/v1';

type RequestOptions = {
  method: string;
  headers: Record<string, string>;
  searchParams?: Record<string, string>;
  json?: Record<string, unknown>;
};

function lastRequest(): { url: string; options: RequestOptions } {
  const call = gotMock.mock.calls[0];
  return { url: call[0] as string, options: call[1] as RequestOptions };
}

function httpFailure(status: number, body: unknown): Error {
  const error = new Error(`Response code ${status}`) as Error & { response: { statusCode: number; body: unknown } };
  error.response = { statusCode: status, body };
  return error;
}

describe('Famulor marketplace plugin', () => {
  const plugin = new Famulor();

  beforeEach(() => {
    gotMock.mockReset();
    validateMock.mockReset();
    validateMock.mockResolvedValue(undefined);
    gotMock.mockResolvedValue({ body: { data: [] } });
  });

  const successCases: Array<{
    name: string;
    query: QueryOptions;
    url: string;
    method: 'GET' | 'POST';
    searchParams?: Record<string, string>;
    json?: Record<string, unknown>;
    body: Record<string, unknown>;
  }> = [
    {
      name: 'list_assistants',
      query: { operation: 'list_assistants' as QueryOptions['operation'], limit: '25', offset: '10' },
      url: `${HOST}/assistants`,
      method: 'GET',
      searchParams: { limit: '25', offset: '10' },
      body: { data: [{ id: 'asst-1' }], meta: { total: 1 } },
    },
    {
      name: 'get_assistant',
      query: { operation: 'get_assistant' as QueryOptions['operation'], assistant_id: 'asst 1' },
      url: `${HOST}/assistants/${encodeURIComponent('asst 1')}`,
      method: 'GET',
      body: { id: 'asst 1', name: 'Reception' },
    },
    {
      name: 'create_call',
      query: {
        operation: 'create_call' as QueryOptions['operation'],
        assistant_id: 'asst-1',
        to_number: ' +4915123456789 ',
        variables: '{"customer_name":"Ada","attempts":2,"vip":true}',
        phone_number_id: 'num-1',
        lead: '{"name":"Ada"}',
      },
      url: `${HOST}/calls`,
      method: 'POST',
      json: {
        assistant_id: 'asst-1',
        to_number: '+4915123456789',
        phone_number_id: 'num-1',
        variables: { customer_name: 'Ada', attempts: 2, vip: true },
        lead: { name: 'Ada' },
      },
      body: { id: 'call-1', status: 'queued' },
    },
    {
      name: 'get_call',
      query: { operation: 'get_call' as QueryOptions['operation'], call_id: 'call-1' },
      url: `${HOST}/calls/call-1`,
      method: 'GET',
      body: { id: 'call-1', status: 'completed' },
    },
    {
      name: 'list_calls',
      query: {
        operation: 'list_calls' as QueryOptions['operation'],
        assistant_id: 'asst-1',
        campaign_id: 'camp-1',
        status: 'completed',
        direction: 'outbound',
        sort: 'updated_at',
        from: '2026-01-01T00:00:00Z',
        to: '2026-02-01T00:00:00Z',
        limit: 5,
        offset: 0,
      },
      url: `${HOST}/calls`,
      method: 'GET',
      searchParams: {
        assistant_id: 'asst-1',
        campaign_id: 'camp-1',
        status: 'completed',
        direction: 'outbound',
        sort: 'updated_at',
        from: '2026-01-01T00:00:00Z',
        to: '2026-02-01T00:00:00Z',
        limit: '5',
        offset: '0',
      },
      body: { data: [{ id: 'call-1' }] },
    },
    {
      name: 'list_campaigns',
      query: { operation: 'list_campaigns' as QueryOptions['operation'], status: 'running' },
      url: `${HOST}/campaigns`,
      method: 'GET',
      searchParams: { status: 'running' },
      body: { data: [{ id: 'camp-1' }] },
    },
    {
      name: 'list_leads',
      query: {
        operation: 'list_leads' as QueryOptions['operation'],
        campaign_id: 'camp/1',
        status: 'pending',
        display_status: 'created',
        limit: '20',
      },
      url: `${HOST}/campaigns/${encodeURIComponent('camp/1')}/leads`,
      method: 'GET',
      searchParams: { status: 'pending', display_status: 'created', limit: '20' },
      body: { data: [{ id: 'lead-1', display_status: 'created' }] },
    },
    {
      name: 'create_lead',
      query: {
        operation: 'create_lead' as QueryOptions['operation'],
        campaign_id: 'camp-1',
        phone: '+491701234567',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        custom_fields: '{"plan":"pro"}',
      },
      url: `${HOST}/campaigns/camp-1/leads`,
      method: 'POST',
      json: {
        phone: '+491701234567',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        custom_fields: { plan: 'pro' },
      },
      body: { data: { id: 'lead-1', phone: '+491701234567' } },
    },
    {
      name: 'list_phone_numbers',
      query: {
        operation: 'list_phone_numbers' as QueryOptions['operation'],
        assistant_id: 'asst-1',
        status: 'active',
        country: 'DE',
      },
      url: `${HOST}/phone-numbers`,
      method: 'GET',
      searchParams: { assistant_id: 'asst-1', status: 'active', country: 'DE' },
      body: { data: [{ id: 'num-1', country: 'DE' }] },
    },
  ];

  it.each(successCases)('$name returns the Famulor body', async (item) => {
    gotMock.mockResolvedValue({ body: item.body });

    await expect(plugin.run(source, item.query, 'ds-1')).resolves.toEqual({ status: 'ok', data: item.body });

    const { url, options } = lastRequest();
    expect(url).toBe(item.url);
    expect(options.method).toBe(item.method);
    expect(options.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(options.headers.Accept).toBe('application/json');
    expect(validateMock).toHaveBeenCalledWith(item.url);
    if (item.searchParams) expect(options.searchParams).toEqual(item.searchParams);
    else expect(options.searchParams).toBeUndefined();
    if (item.json) {
      expect(options.json).toEqual(item.json);
      expect(options.headers['Content-Type']).toBe('application/json');
    } else {
      expect(options.json).toBeUndefined();
    }
    expect(JSON.stringify(options.json ?? {})).not.toContain(KEY);
  });

  it.each(successCases)('$name surfaces the Famulor error envelope', async (item) => {
    gotMock.mockRejectedValue(
      httpFailure(403, { error: { code: 'destination_forbidden', message: 'That destination is blocked.' } })
    );

    await expect(plugin.run(source, item.query, 'ds-1')).rejects.toMatchObject({
      message: 'Query could not be completed',
      description: 'HTTP 403 destination_forbidden: That destination is blocked.',
      data: {
        status: 403,
        body: { error: { code: 'destination_forbidden', message: 'That destination is blocked.' } },
      },
    });

    const thrown = await plugin.run(source, item.query, 'ds-1').catch((error: unknown) => error);
    expect(JSON.stringify(thrown)).not.toContain(KEY);
    expect(JSON.stringify(lastRequest().options.headers.Authorization)).toContain(KEY);
  });

  it('omits blank list filters and does not send a body on GET', async () => {
    await plugin.run(
      source,
      {
        operation: 'list_calls' as QueryOptions['operation'],
        assistant_id: '  ',
        status: '',
        direction: '',
        sort: '',
        from: '',
        to: '',
        limit: '',
        offset: '',
      },
      'ds-1'
    );

    const { options } = lastRequest();
    expect(options.method).toBe('GET');
    expect(options.searchParams).toBeUndefined();
    expect(options.json).toBeUndefined();
  });

  it('rejects a missing assistant id before calling Famulor', async () => {
    await expect(
      plugin.run(source, { operation: 'get_assistant' as QueryOptions['operation'], assistant_id: ' ' }, 'ds-1')
    ).rejects.toMatchObject({ description: 'Assistant ID is required.' });
    expect(gotMock).not.toHaveBeenCalled();
  });

  it('rejects a missing phone number on an outbound call', async () => {
    await expect(
      plugin.run(
        source,
        { operation: 'create_call' as QueryOptions['operation'], assistant_id: 'asst-1', to_number: '' },
        'ds-1'
      )
    ).rejects.toMatchObject({ description: 'Phone number is required.' });
    expect(gotMock).not.toHaveBeenCalled();
  });

  it('rejects a missing campaign id and phone when creating a lead', async () => {
    await expect(
      plugin.run(source, { operation: 'create_lead' as QueryOptions['operation'], campaign_id: 'camp-1' }, 'ds-1')
    ).rejects.toMatchObject({ description: 'Phone is required.' });
    await expect(
      plugin.run(source, { operation: 'list_leads' as QueryOptions['operation'] }, 'ds-1')
    ).rejects.toMatchObject({ description: 'Campaign ID is required.' });
    expect(gotMock).not.toHaveBeenCalled();
  });

  it('rejects variables that are not the documented scalar object', async () => {
    const base = {
      operation: 'create_call' as QueryOptions['operation'],
      assistant_id: 'asst-1',
      to_number: '+4915123456789',
    };
    await expect(plugin.run(source, { ...base, variables: '{not json' }, 'ds-1')).rejects.toMatchObject({
      description: 'Variables must be valid JSON.',
    });
    await expect(plugin.run(source, { ...base, variables: '["nope"]' }, 'ds-1')).rejects.toMatchObject({
      description: 'Variables must be a JSON object.',
    });
    await expect(plugin.run(source, { ...base, variables: '{"Bad-Key":"x"}' }, 'ds-1')).rejects.toMatchObject({
      description: expect.stringContaining('Variables key "Bad-Key"'),
    });
    await expect(plugin.run(source, { ...base, variables: '{"name":{"nested":true}}' }, 'ds-1')).rejects.toMatchObject({
      description: 'Variables.name must be a string, number, or boolean.',
    });
    await expect(plugin.run(source, { ...base, variables: { note: 'x'.repeat(2001) } }, 'ds-1')).rejects.toMatchObject({
      description: 'Variables.note must be at most 2000 characters.',
    });
    expect(gotMock).not.toHaveBeenCalled();
  });

  it('rejects a limit outside 1–200', async () => {
    await expect(
      plugin.run(source, { operation: 'list_assistants' as QueryOptions['operation'], limit: '0' }, 'ds-1')
    ).rejects.toMatchObject({ description: 'Limit must be an integer from 1 to 200.' });
    await expect(
      plugin.run(source, { operation: 'list_assistants' as QueryOptions['operation'], limit: '201' }, 'ds-1')
    ).rejects.toMatchObject({ description: 'Limit must be an integer from 1 to 200.' });
    await expect(
      plugin.run(source, { operation: 'list_assistants' as QueryOptions['operation'], offset: '-1' }, 'ds-1')
    ).rejects.toMatchObject({ description: 'Offset must be an integer >= 0.' });
    expect(gotMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown operation', async () => {
    await expect(
      plugin.run(source, { operation: 'drop_database' as QueryOptions['operation'] }, 'ds-1')
    ).rejects.toMatchObject({ description: 'Unknown operation drop_database' });
    expect(gotMock).not.toHaveBeenCalled();
  });

  it('rejects a missing API key without calling Famulor', async () => {
    await expect(
      plugin.run({ api_key: '  ' }, { operation: 'list_assistants' as QueryOptions['operation'] }, 'ds-1')
    ).rejects.toMatchObject({ description: 'API key is required.' });
    expect(gotMock).not.toHaveBeenCalled();
  });

  it('reports an HTTP error that is not the Famulor envelope', async () => {
    gotMock.mockRejectedValue(httpFailure(502, 'bad gateway'));
    await expect(
      plugin.run(source, { operation: 'list_campaigns' as QueryOptions['operation'] }, 'ds-1')
    ).rejects.toMatchObject({
      description: 'HTTP 502',
      data: { status: 502, body: { raw: 'bad gateway' } },
    });
  });

  it('reports a network failure without a response', async () => {
    gotMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    await expect(
      plugin.run(source, { operation: 'list_phone_numbers' as QueryOptions['operation'] }, 'ds-1')
    ).rejects.toBeInstanceOf(QueryError);
    await expect(
      plugin.run(source, { operation: 'list_phone_numbers' as QueryOptions['operation'] }, 'ds-1')
    ).rejects.toMatchObject({ description: 'connect ECONNREFUSED' });
  });

  it('uses a white-label origin and appends /api/v1', async () => {
    await plugin.run(
      { api_key: `  ${KEY}  `, base_url: 'https://voice.example.com/' },
      { operation: 'get_call' as QueryOptions['operation'], call_id: 'call-1' },
      'ds-1'
    );
    const { url, options } = lastRequest();
    expect(url).toBe('https://voice.example.com/api/v1/calls/call-1');
    expect(options.headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it('keeps an explicit API root and strips a trailing slash', async () => {
    await plugin.run(
      { ...source, base_url: 'https://voice.example.com/api/v1/' },
      { operation: 'list_assistants' as QueryOptions['operation'] },
      'ds-1'
    );
    expect(lastRequest().url).toBe('https://voice.example.com/api/v1/assistants');
  });

  it('rejects a base URL with a query string before calling Famulor', async () => {
    await expect(
      plugin.run(
        { ...source, base_url: 'https://voice.example.com/api/v1?token=secret' },
        { operation: 'list_assistants' as QueryOptions['operation'] },
        'ds-1'
      )
    ).rejects.toMatchObject({ description: 'Base URL must not include a query string or hash.' });
    expect(gotMock).not.toHaveBeenCalled();
  });

  it('blocks a loopback base URL and does not send the key', async () => {
    const actual = jest.requireActual('@tooljet-marketplace/common').validateUrlForSSRF as (
      url: string
    ) => Promise<void>;
    validateMock.mockImplementation(actual);

    await expect(
      plugin.run(
        { ...source, base_url: 'http://127.0.0.1/api/v1' },
        { operation: 'list_assistants' as QueryOptions['operation'] },
        'ds-1'
      )
    ).rejects.toMatchObject({ message: 'Private IP address blocked' });
    expect(gotMock).not.toHaveBeenCalled();
  });

  it('test connection reads GET /me and does not place a call', async () => {
    gotMock.mockResolvedValue({ body: { id: 'key-1' } });
    await expect(plugin.testConnection(source)).resolves.toEqual({ status: 'ok' });
    const { url, options } = lastRequest();
    expect(url).toBe(`${HOST}/me`);
    expect(options.method).toBe('GET');
    expect(options.json).toBeUndefined();
  });

  it('test connection reports an unauthorized key without throwing', async () => {
    gotMock.mockRejectedValue(httpFailure(401, { error: { code: 'unauthorized', message: 'Invalid API key.' } }));
    await expect(plugin.testConnection(source)).resolves.toEqual({
      status: 'failed',
      message: 'HTTP 401 unauthorized: Invalid API key.',
    });
  });

  it('test connection reports a missing key without calling Famulor', async () => {
    await expect(plugin.testConnection({ api_key: '' })).resolves.toEqual({
      status: 'failed',
      message: 'API key is required.',
    });
    expect(gotMock).not.toHaveBeenCalled();
  });
});
