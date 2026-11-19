# WiNK Backend Test: Blog and CMS API

A REST API for two clients: a public blog and a content management system.
Built with Express 5, MongoDB (Mongoose) and TypeScript.

## Run it

With Docker only:

```bash
docker compose up --build
```

The API is on http://localhost:3000.

Or locally, with Node 24:

```bash
cp .env.example .env
docker compose up -d mongo
npm ci
npm run dev
```

## Token

There is no authentication system, as the task says. CMS calls need this hardcoded token:

```
Authorization: Bearer wink-cms-hardcoded-token
```

Blog calls need no token. The token can be changed with the `CMS_API_TOKEN` variable.

## Endpoints

| Client | Method and path                      | What it does                               |
| ------ | ------------------------------------ | ------------------------------------------ |
| Blog   | `GET /api/v1/posts`                  | List published posts, filter by `hashtags` |
| Blog   | `GET /api/v1/posts/:id`              | Read one published post                    |
| CMS    | `POST /api/v1/cms/posts`             | Create a post                              |
| CMS    | `GET /api/v1/cms/posts`              | List all posts, filter by `status`         |
| CMS    | `GET /api/v1/cms/posts/:id`          | Read one post of any status                |
| CMS    | `POST /api/v1/cms/posts/:id/publish` | Publish a post                             |
| CMS    | `DELETE /api/v1/cms/posts/:id`       | Delete a post                              |
|        | `GET /health`                        | Health check                               |

Lists take `page` (default 1) and `limit` (default 20, max 100) and return
`{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`.

The full contract is in [docs/openapi.yaml](docs/openapi.yaml).

Errors always look the same:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "path": "title", "message": "..." }]
  }
}
```

Codes: `VALIDATION_ERROR` and `INVALID_JSON` (400), `UNAUTHORIZED` (401), `NOT_FOUND` (404),
`PAYLOAD_TOO_LARGE` (413), `INTERNAL_ERROR` (500).

## Try it

```bash
API=http://localhost:3000/api/v1
AUTH='Authorization: Bearer wink-cms-hardcoded-token'

# 1. Create a draft. Copy the "id" from the response.
curl -s -X POST $API/cms/posts -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":"Hello WiNK","body":"First post","hashtags":["#NodeJS","express"]}'
ID=<paste the id here>

# 2. The blog does not show drafts: empty list, and 404 by id.
curl -s $API/posts
curl -s $API/posts/$ID

# 3. Publish it.
curl -s -X POST $API/cms/posts/$ID/publish -H "$AUTH"

# 4. Find it by hashtag. Case and a leading # (%23) do not matter.
curl -s "$API/posts?hashtags=%23NODEJS,mongodb"

# 5. Publish again: same post, same publishedAt.
curl -s -X POST $API/cms/posts/$ID/publish -H "$AUTH"

# 6. Delete it: 204, then 404.
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $API/cms/posts/$ID -H "$AUTH"
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $API/cms/posts/$ID -H "$AUTH"

# A CMS call without the token: 401.
curl -s -X POST $API/cms/posts -H 'Content-Type: application/json' -d '{}'
```

## Decisions

The task leaves some things open. This is what I chose and why.

- **Two routers, one per client.** The blog router only reads and always filters by
  `status: published`, so it cannot return a draft: not in the list, not in the total count, not
  by id (a draft answers 404, so its existence is not revealed). The token is checked once for the
  whole CMS router.
- **Create.** The server always sets the author to Brian Fox; sending `author` (or any unknown
  field) is a 400. A missing `status` means `draft`, and `published` can be sent to publish right
  away. Missing `hashtags` means `[]`; if sent, it must be an array of strings.
- **Publish is `POST /:id/publish`.** It is one atomic MongoDB update with the condition
  `status: draft`. Publishing an already published post returns it unchanged, so a retry is safe,
  and two requests at the same time end up with one `publishedAt`.
- **Hashtags** are stored in one form: trimmed, without a leading `#`, lowercased, no duplicates.
  The filter normalizes its input the same way, so `#NodeJS` and `nodejs` are the same tag.
  Allowed characters are letters, digits and `_`.
- **Filtering by several hashtags** returns posts that have **any** of them
  (`?hashtags=node,express`).
- **The blog sorts by `publishedAt`**, not by creation date, with `_id` as a tie-breaker so pages
  stay stable. Indexes cover the feed, the hashtag filter and the CMS list.
- **Delete** removes the post for real and works for any status.
- **The post body is stored as plain text.** The API returns JSON and does not interpret it.
  Escaping it when rendering HTML is the client's job.
- **CORS** is open by default (`CORS_ORIGIN=*`) because the clients are likely browser apps on
  other origins. It only lets a browser read the response. Access to the CMS is decided by the
  token.

## Project structure

```
src/
  server.ts      connects to MongoDB and starts the HTTP server
  app.ts         builds the Express app (tests use it without opening a port)
  config.ts      environment variables
  errors.ts      application errors
  middleware/    token check, 404 and error handler
  posts/         routes -> service -> model, plus validation schemas and hashtag rules
tests/           HTTP tests against a real MongoDB
docs/            OpenAPI spec
```

Routes parse and validate the request. The service holds the rules (visibility, publishing,
author). The model describes how a post is stored.

## Tests

```bash
npm test
```

The tests send HTTP requests to the real app and use a real MongoDB started by
`mongodb-memory-server`. The first run downloads a MongoDB binary, so it needs a network
connection and takes longer.

Other checks: `npm run lint`, `npm run typecheck`, `npm run build`.

## Next steps

Things I left out because the task does not ask for them: editing and unpublishing a post, real
authentication with roles, rate limiting, structured logs, cursor pagination for large feeds, CI.
