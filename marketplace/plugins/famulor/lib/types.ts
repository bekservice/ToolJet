export const DEFAULT_BASE_URL = 'https://app.famulor.io/api/v1';

export type SourceOptions = {
  /** Famulor API key (`fam_...`). Sent as a bearer token. Stored encrypted. */
  api_key: string;
  /**
   * API root, including `/api/v1`. Blank uses the hosted platform.
   * A bare origin is treated as the documented white-label server and gets `/api/v1` appended.
   */
  base_url?: string;
};

export enum Operation {
  ListAssistants = 'list_assistants',
  GetAssistant = 'get_assistant',
  CreateCall = 'create_call',
  GetCall = 'get_call',
  ListCalls = 'list_calls',
  ListCampaigns = 'list_campaigns',
  ListLeads = 'list_leads',
  CreateLead = 'create_lead',
  ListPhoneNumbers = 'list_phone_numbers',
}

export type QueryOptions = {
  operation: Operation;
  limit?: string | number;
  offset?: string | number;
  assistant_id?: string;
  call_id?: string;
  campaign_id?: string;
  /** Destination number. The Famulor field name is `to_number`. */
  to_number?: string;
  /** Optional caller-id phone number UUID. Not the destination. */
  phone_number_id?: string;
  variables?: string | Record<string, unknown>;
  lead?: string | Record<string, unknown>;
  status?: string;
  direction?: string;
  sort?: string;
  from?: string;
  to?: string;
  display_status?: string;
  country?: string;
  phone?: string;
  email?: string;
  name?: string;
  custom_fields?: string | Record<string, unknown>;
};
