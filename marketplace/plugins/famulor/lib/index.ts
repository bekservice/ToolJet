import {
  ConnectionTestResult,
  QueryError,
  QueryResult,
  QueryService,
  getSSRFProtectionOptions,
  validateUrlForSSRF,
} from '@tooljet-marketplace/common';
import got from 'got';
import { DEFAULT_BASE_URL, Operation, QueryOptions, SourceOptions } from './types';

const REQUEST_TIMEOUT_MS = 30000;
const VARIABLE_KEY = /^[a-z][a-z0-9_]{0,63}$/;
const RESERVED_VARIABLE_KEYS = new Set(['constructor', 'prototype', '__proto__']);

/**
 * Famulor AI voice agents.
 *
 * Hand-written operations over the documented v1 REST API (bearer API key).
 * Test connection calls GET /me, which any valid key can read and which does not place a call.
 * Campaign leads are the resources named "leads" in the API (listLeads / addLeads).
 */
export default class Famulor implements QueryService {
  async run(sourceOptions: SourceOptions, queryOptions: QueryOptions, _dataSourceId: string): Promise<QueryResult> {
    const data = await this.dispatch(sourceOptions, queryOptions);
    return { status: 'ok', data: asQueryData(data) };
  }

  async testConnection(sourceOptions: SourceOptions): Promise<ConnectionTestResult> {
    try {
      await this.request(sourceOptions, 'GET', '/me');
      return { status: 'ok' };
    } catch (error) {
      return { status: 'failed', message: errorText(error) };
    }
  }

  private async dispatch(sourceOptions: SourceOptions, queryOptions: QueryOptions): Promise<unknown> {
    const operation = queryOptions.operation;
    switch (operation) {
      case Operation.ListAssistants:
        return this.request(sourceOptions, 'GET', '/assistants', pageQuery(queryOptions));
      case Operation.GetAssistant:
        return this.request(
          sourceOptions,
          'GET',
          `/assistants/${encodeURIComponent(requiredText(queryOptions.assistant_id, 'Assistant ID'))}`
        );
      case Operation.CreateCall:
        return this.request(sourceOptions, 'POST', '/calls', undefined, outboundCallBody(queryOptions));
      case Operation.GetCall:
        return this.request(
          sourceOptions,
          'GET',
          `/calls/${encodeURIComponent(requiredText(queryOptions.call_id, 'Call ID'))}`
        );
      case Operation.ListCalls:
        return this.request(sourceOptions, 'GET', '/calls', listCallsQuery(queryOptions));
      case Operation.ListCampaigns:
        return this.request(sourceOptions, 'GET', '/campaigns', listCampaignsQuery(queryOptions));
      case Operation.ListLeads:
        return this.request(
          sourceOptions,
          'GET',
          `/campaigns/${encodeURIComponent(requiredText(queryOptions.campaign_id, 'Campaign ID'))}/leads`,
          listLeadsQuery(queryOptions)
        );
      case Operation.CreateLead:
        return this.request(
          sourceOptions,
          'POST',
          `/campaigns/${encodeURIComponent(requiredText(queryOptions.campaign_id, 'Campaign ID'))}/leads`,
          undefined,
          leadBody(queryOptions)
        );
      case Operation.ListPhoneNumbers:
        return this.request(sourceOptions, 'GET', '/phone-numbers', listPhoneNumbersQuery(queryOptions));
      default: {
        const unexpected: never = operation;
        throw new QueryError('Query could not be completed', `Unknown operation ${String(unexpected)}`, {});
      }
    }
  }

  private async request(
    sourceOptions: SourceOptions,
    method: 'GET' | 'POST',
    path: string,
    query?: Record<string, string>,
    json?: Record<string, unknown>
  ): Promise<unknown> {
    const apiKey = requiredText(sourceOptions.api_key, 'API key');
    const url = `${resolveBaseUrl(sourceOptions.base_url)}${path}`;
    await validateUrlForSSRF(url);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
    const options: Record<string, unknown> = {
      method,
      headers,
      responseType: 'json',
      timeout: { request: REQUEST_TIMEOUT_MS },
    };
    if (query && Object.keys(query).length > 0) options.searchParams = query;
    if (json) {
      headers['Content-Type'] = 'application/json';
      options.json = json;
    }

    try {
      const response = await got(url, getSSRFProtectionOptions(undefined, options));
      return response.body;
    } catch (error) {
      throw toQueryError(error);
    }
  }
}

function listCallsQuery(queryOptions: QueryOptions): Record<string, string> {
  const query = pageQuery(queryOptions);
  assignText(query, 'assistant_id', queryOptions.assistant_id);
  assignText(query, 'campaign_id', queryOptions.campaign_id);
  assignText(query, 'status', queryOptions.status);
  assignText(query, 'direction', queryOptions.direction);
  assignText(query, 'sort', queryOptions.sort);
  assignText(query, 'from', queryOptions.from);
  assignText(query, 'to', queryOptions.to);
  return query;
}

function listCampaignsQuery(queryOptions: QueryOptions): Record<string, string> {
  const query = pageQuery(queryOptions);
  assignText(query, 'status', queryOptions.status);
  return query;
}

function listLeadsQuery(queryOptions: QueryOptions): Record<string, string> {
  const query = pageQuery(queryOptions);
  assignText(query, 'status', queryOptions.status);
  assignText(query, 'display_status', queryOptions.display_status);
  return query;
}

function listPhoneNumbersQuery(queryOptions: QueryOptions): Record<string, string> {
  const query = pageQuery(queryOptions);
  assignText(query, 'assistant_id', queryOptions.assistant_id);
  assignText(query, 'status', queryOptions.status);
  assignText(query, 'country', queryOptions.country);
  return query;
}

function outboundCallBody(queryOptions: QueryOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    assistant_id: requiredText(queryOptions.assistant_id, 'Assistant ID'),
    to_number: requiredText(queryOptions.to_number, 'Phone number'),
  };
  const phoneNumberId = optionalText(queryOptions.phone_number_id);
  if (phoneNumberId) body.phone_number_id = phoneNumberId;
  const variables = parseVariables(queryOptions.variables);
  if (variables) body.variables = variables;
  const lead = parseJsonObject(queryOptions.lead, 'Lead');
  if (lead) body.lead = lead;
  return body;
}

function leadBody(queryOptions: QueryOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    phone: requiredText(queryOptions.phone, 'Phone'),
  };
  const name = optionalText(queryOptions.name);
  if (name) body.name = name;
  const email = optionalText(queryOptions.email);
  if (email) body.email = email;
  const customFields = parseJsonObject(queryOptions.custom_fields, 'Custom fields');
  if (customFields) body.custom_fields = customFields;
  return body;
}

function pageQuery(queryOptions: QueryOptions): Record<string, string> {
  const query: Record<string, string> = {};
  const limit = optionalInt(queryOptions.limit, 'Limit', 1, 200);
  const offset = optionalInt(queryOptions.offset, 'Offset', 0);
  if (limit) query.limit = limit;
  if (offset) query.offset = offset;
  return query;
}

function assignText(query: Record<string, string>, key: string, raw: unknown): void {
  const text = optionalText(raw);
  if (text) query[key] = text;
}

/**
 * Blank uses the hosted API. A bare origin gets `/api/v1`, matching the white-label server URL
 * `https://{domain}/api/v1`. A path that is already set is kept, so an explicit `/api/v1` stays put.
 */
function resolveBaseUrl(raw: string | undefined): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return DEFAULT_BASE_URL;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new QueryError('Query could not be completed', 'Base URL must be an absolute URL.', {});
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new QueryError('Query could not be completed', 'Base URL must use http or https.', {});
  }
  if (url.username || url.password) {
    throw new QueryError('Query could not be completed', 'Base URL must not include credentials.', {});
  }
  if (url.search || url.hash) {
    throw new QueryError('Query could not be completed', 'Base URL must not include a query string or hash.', {});
  }

  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path === '' ? '/api/v1' : path;
  return url.toString().replace(/\/+$/, '');
}

function optionalText(raw: unknown): string | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();
  return text === '' ? undefined : text;
}

function requiredText(raw: unknown, field: string): string {
  const text = optionalText(raw);
  if (!text) {
    throw new QueryError('Query could not be completed', `${field} is required.`, {});
  }
  return text;
}

function optionalInt(raw: unknown, field: string, min: number, max?: number): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'string' && raw.trim() === '') return undefined;
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
  const aboveMax = max !== undefined && value > max;
  if (!Number.isInteger(value) || value < min || aboveMax) {
    const range = max === undefined ? `an integer >= ${min}` : `an integer from ${min} to ${max}`;
    throw new QueryError('Query could not be completed', `${field} must be ${range}.`, {});
  }
  return String(value);
}

function parseJsonObject(raw: unknown, field: string): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new QueryError('Query could not be completed', `${field} must be valid JSON.`, {});
    }
  }
  if (!isRecord(parsed)) {
    throw new QueryError('Query could not be completed', `${field} must be a JSON object.`, {});
  }
  return parsed;
}

/** Per-call variables follow CallInputVariables: lowercase keys, scalar values, 2000-character strings. */
function parseVariables(raw: unknown): Record<string, string | number | boolean> | undefined {
  const parsed = parseJsonObject(raw, 'Variables');
  if (!parsed) return undefined;

  const variables: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (RESERVED_VARIABLE_KEYS.has(key) || !VARIABLE_KEY.test(key)) {
      throw new QueryError(
        'Query could not be completed',
        `Variables key "${key}" must match ${VARIABLE_KEY.source} and must not be constructor, prototype, or __proto__.`,
        {}
      );
    }
    if (typeof value === 'string') {
      if (value.length > 2000) {
        throw new QueryError('Query could not be completed', `Variables.${key} must be at most 2000 characters.`, {});
      }
      variables[key] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      variables[key] = value;
    } else if (typeof value === 'boolean') {
      variables[key] = value;
    } else {
      throw new QueryError(
        'Query could not be completed',
        `Variables.${key} must be a string, number, or boolean.`,
        {}
      );
    }
  }
  return variables;
}

function toQueryError(error: unknown): QueryError {
  if (error instanceof QueryError) return error;
  const http = readHttpFailure(error);
  if (http) {
    return new QueryError('Query could not be completed', famulorMessage(http.status, http.body), {
      status: http.status,
      body: asErrorBody(http.body),
    });
  }
  const message = error instanceof Error && error.message ? error.message : 'The request to Famulor failed.';
  return new QueryError('Query could not be completed', message, {});
}

function famulorMessage(status: number, body: unknown): string {
  if (isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string' && body.error.message) {
    const code = typeof body.error.code === 'string' && body.error.code ? body.error.code : 'error';
    return `HTTP ${status} ${code}: ${body.error.message}`;
  }
  return `HTTP ${status}`;
}

function readHttpFailure(error: unknown): { status: number; body: unknown } | undefined {
  if (!isRecord(error) || !isRecord(error.response)) return undefined;
  const status = error.response.statusCode;
  if (typeof status !== 'number') return undefined;
  return { status, body: error.response.body };
}

function asErrorBody(body: unknown): Record<string, unknown> {
  if (isRecord(body)) return body;
  return { raw: body === undefined ? null : String(body).slice(0, 1000) };
}

function asQueryData(body: unknown): QueryResult['data'] {
  if (Array.isArray(body)) return body as unknown as object[];
  if (isRecord(body)) return body;
  return { result: body ?? null };
}

function errorText(error: unknown): string {
  if (error instanceof QueryError) {
    const description = error.description;
    return typeof description === 'string' && description ? description : error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'The request to Famulor failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
