---
id: marketplace-plugin-famulor
title: Famulor
---

ToolJet connects to [Famulor](https://www.famulor.io) so an app can list AI voice assistants, place an outbound call, and read calls, campaigns, campaign leads, and phone numbers.

:::info
**NOTE:** **Before following this guide, it is assumed that you have already completed the process of [Using Marketplace plugins](/docs/marketplace/marketplace-overview#using-marketplace-plugins)**.
:::

## Connection

- Add the data source from the query panel (**+ Add new data source**) or from the [Data sources](/docs/data-sources/overview/) page.
- **API key**: a Famulor key (`fam_...`) from **Settings → API Keys** in [app.famulor.io](https://app.famulor.io). The key is stored encrypted and sent as `Authorization: Bearer`.
- **Base URL** (optional): leave blank for `https://app.famulor.io/api/v1`. On a white-label domain, enter `https://<your-domain>` or `https://<your-domain>/api/v1`.
- Click **Test connection**. ToolJet calls `GET /me`, which checks the key and does not place a call. Then click **Save**.

The key needs the scopes of the operations you run (`assistants:read`, `calls:write`, `leads:read`, `leads:write`, `phone_numbers:read`, and so on). A key with no scope restriction can call every operation the workspace allows. `GET /me` itself needs no scope.

## Operations

| Operation | What it does |
| --- | --- |
| List assistants | Paginated assistants, newest first. |
| Get assistant | One assistant by ID. |
| Make outbound call | Starts a call. Requires an active **Assistant ID** and a destination **Phone number** in E.164 (sent as `to_number`). Optional **Variables** (JSON), **Caller ID**, and **Lead** (JSON). The response is the queued call; use **Get call** for the result. |
| Get call | One call by ID. |
| List calls | Calls filtered by assistant, campaign, status, direction, sort, and a created-at window. |
| List campaigns | Campaigns, optionally by status. |
| List leads | Leads of one campaign. |
| Create lead | Adds one lead to a campaign. **Phone** is required. Name, email, and custom fields are optional. |
| List phone numbers | Numbers in the workspace, optionally by assistant, status, or country. |

**Limit** is a page size from 1 to 200. Leave it blank to use Famulor's default of 50. **Offset** is how many items to skip.

**Variables** is a JSON object. Keys are lowercase letters, digits, and underscores, starting with a letter (up to 64 characters). Values are strings of at most 2000 characters, numbers, or booleans.

Endpoint reference: [Famulor API docs](https://docs.famulor.io).
