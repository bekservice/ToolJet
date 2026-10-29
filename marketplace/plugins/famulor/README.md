# Famulor

Connect [Famulor](https://www.famulor.io) AI voice agents to a ToolJet app: list assistants, place an outbound call, read calls, campaigns, campaign leads, and phone numbers.

The API root is `https://app.famulor.io/api/v1`. A key (`fam_...`) is stored encrypted and sent as `Authorization: Bearer`. **Test connection** calls `GET /me`, which validates the key without placing a call. Leave **Base URL** blank unless you are on a white-label domain (`https://<domain>/api/v1`).

## Operations

| Operation | Endpoint | Notes |
| --- | --- | --- |
| List assistants | `GET /assistants` | `limit` 1–200, `offset` |
| Get assistant | `GET /assistants/{id}` | |
| Make outbound call | `POST /calls` | `assistant_id`, phone number (`to_number`), optional `variables`, caller-id `phone_number_id`, and `lead`. Returns the queued call. |
| Get call | `GET /calls/{id}` | Poll this after placing a call |
| List calls | `GET /calls` | Filter by assistant, campaign, status, direction, sort, and a created-at window |
| List campaigns | `GET /campaigns` | |
| List leads | `GET /campaigns/{id}/leads` | Campaign leads (`listLeads`) |
| Create lead | `POST /campaigns/{id}/leads` | One lead: `phone` plus optional name, email, and custom fields |
| List phone numbers | `GET /phone-numbers` | |

`variables` is a JSON object whose keys match `^[a-z][a-z0-9_]{0,63}$`. Values are strings (max 2000 characters), numbers, or booleans. Docs: [docs.famulor.io](https://docs.famulor.io).

Audience contacts (`GET /leads` and `POST /leads`) are a different resource and are not included.

## Logo

`lib/icon.svg` is Famulor's cyan toggle mark from [famulor.io/icon.svg](https://www.famulor.io/icon.svg), scaled uniformly into ToolJet's 24×24 icon box. Colors are unchanged.
