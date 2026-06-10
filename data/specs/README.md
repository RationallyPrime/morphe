# Business API Specs

Downloaded on 2026-06-10 for Composer grounding and capability-edge exploration.

These are official vendor specs or official vendor-published machine-readable API
descriptions. Formats are kept in their native form so downstream tooling can choose
the right parser. BambooHR was already downloaded one level up at
`data/bamboohr-public-openapi.yaml`.

| System | Category | File | Format | Source |
|---|---|---|---|---|
| BambooHR | HRIS / people | `../bamboohr-public-openapi.yaml` | OpenAPI 3.1 YAML | `https://openapi.bamboohr.io/main/latest/docs/openapi/public-openapi.yaml` |
| 50skills Journeys | HR workflow automation | `50skills-journeys-api.yaml` | OpenAPI 3.0 YAML | `https://docs.50skills.app/journeys` -> `Specification` |
| Microsoft Dynamics 365 Business Central | ERP / accounting | `microsoft-business-central-v1-openapi.yaml` | OpenAPI 3.0 YAML | `https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v1.0/contracts/bcoas1.0.yaml` |
| Stripe | payments | `stripe-openapi-spec3.json` | OpenAPI 3.0 JSON | `https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json` |
| Square | POS / payments / commerce | `square-api.json` | OpenAPI 3.0 JSON | `https://raw.githubusercontent.com/square/connect-api-specification/master/api.json` |
| Xero | accounting | `xero-accounting.yaml` | OpenAPI 3.0 YAML | `https://raw.githubusercontent.com/XeroAPI/Xero-OpenAPI/master/xero_accounting.yaml` |
| Xero | payroll | `xero-payroll-uk.yaml` | OpenAPI 3.0 YAML | `https://raw.githubusercontent.com/XeroAPI/Xero-OpenAPI/master/xero-payroll-uk.yaml` |
| Xero | projects | `xero-projects.yaml` | OpenAPI 3.0 YAML | `https://raw.githubusercontent.com/XeroAPI/Xero-OpenAPI/master/xero-projects.yaml` |
| Google Calendar | calendar | `google-calendar-v3-discovery.json` | Google Discovery JSON | `https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest` |
| Gmail | email | `google-gmail-v1-discovery.json` | Google Discovery JSON | `https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest` |
| Google Drive | documents / files | `google-drive-v3-discovery.json` | Google Discovery JSON | `https://www.googleapis.com/discovery/v1/apis/drive/v3/rest` |
| Microsoft Graph | Microsoft 365 / Teams / Outlook | `microsoft-graph-openapi-v1.yaml` | OpenAPI 3.0 YAML | `https://raw.githubusercontent.com/microsoftgraph/msgraph-metadata/master/openapi/v1.0/openapi.yaml` |
| Pipedrive | CRM | `pipedrive-openapi-v1.yaml` | OpenAPI 3.0 YAML | `https://developers.pipedrive.com/docs/api/v1/openapi.yaml` |
| HubSpot Contacts | CRM | `hubspot-crm-contacts-2026-03.json` | OpenAPI 3.0 JSON | `https://raw.githubusercontent.com/HubSpot/HubSpot-public-api-spec-collection/main/PublicApiSpecs/CRM/Contacts/Rollouts/424/2026-03/contacts.json` |
| HubSpot Companies | CRM | `hubspot-crm-companies-2026-03.json` | OpenAPI 3.0 JSON | `https://raw.githubusercontent.com/HubSpot/HubSpot-public-api-spec-collection/main/PublicApiSpecs/CRM/Companies/Rollouts/424/2026-03/companies.json` |
| HubSpot Deals | CRM | `hubspot-crm-deals-2026-03.json` | OpenAPI 3.0 JSON | `https://raw.githubusercontent.com/HubSpot/HubSpot-public-api-spec-collection/main/PublicApiSpecs/CRM/Deals/Rollouts/424/2026-03/deals.json` |
| HubSpot Webhooks | CRM events | `hubspot-webhooks-2026-03.json` | OpenAPI 3.0 JSON | `https://raw.githubusercontent.com/HubSpot/HubSpot-public-api-spec-collection/main/PublicApiSpecs/Webhooks/Webhooks/Rollouts/147891/2026-03/webhooks.json` |
| Slack Web API | comms / approval | `slack-web-openapi-v2.json` | Swagger 2.0 JSON | `https://raw.githubusercontent.com/slackapi/slack-api-specs/master/web-api/slack_web_openapi_v2_without_examples.json` |
| Slack Events | comms events | `slack-events-asyncapi-v1.json` | AsyncAPI 1.2 JSON | `https://raw.githubusercontent.com/slackapi/slack-api-specs/master/events-api/slack_events_api_async_v1.json` |

HubSpot also publishes `2026-09` rollout specs in the same repo. Those are not used here
because they are future-dated relative to 2026-06-10; `2026-03` is the latest released
rollout selected in this pass.

## Screened From Iceland SaaS Pass

- Microsoft publishes Business Central API v2.0 reference docs, but its OpenAPI page says
  there is no downloadable `.yaml` for API v2.0 and provides the v1.0 YAML instead.
- Wisefish publishes detailed public endpoint reference pages for its Business
  Central-backed vertical APIs, but no raw OpenAPI/Swagger artifact was found in this pass.
- Regla publicly advertises `Vefþjónusta / API`, but the public product page does not expose
  a machine-readable OpenAPI/Swagger/GraphQL schema.
- PayAnalytics, Controlant, Meniga, Teya, Taktikal, Kara Connect and Stonemark Alfred were
  not added from the Gemini-generated report without an official public machine-readable
  schema URL.
