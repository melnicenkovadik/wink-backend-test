# WiNK Backend Test: Blog and CMS API

A REST API for two clients: a public blog and a content management system.
Built with Express 5, MongoDB (Mongoose) and TypeScript.

## Run it

With Docker only:

```bash
docker compose up --build
```

The API is on http://localhost:3000 and the interactive docs (Swagger UI) are on
http://localhost:3000/docs.

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

Blog calls need no token. The token can be changed with the `CMS_API_TOKEN` variable in `.env`
(Docker Compose reads the same file).

## Endpoints

| Client | Method and path                      | What it does                               |
| ------ | ------------------------------------ | ------------------------------------------ |
| Blog   | `GET /api/v1/posts`                  | List published posts, filter by `hashtags` |
| Blog   | `GET /api/v1/posts/:id`              | Read one published post                    |
| CMS    | `POST /api/v1/cms/posts`             | Create a post                              |
| CMS    | `GET /api/v1/cms/posts`              | List all posts, filter by `status`         |
| CMS    | `GET /api/v1/cms/posts/:id`          | Read one post of any status                |
| CMS    | `PATCH /api/v1/cms/posts/:id`        | Edit title, body or hashtags               |
| CMS    | `POST /api/v1/cms/posts/:id/publish` | Publish a post                             |
| CMS    | `DELETE /api/v1/cms/posts/:id`       | Delete a post                              |
|        | `GET /health`                        | Health check                               |

Lists take `page` (default 1) and `limit` (default 20, max 100) and return
`{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`.

The full contract is in [docs/openapi.yaml](docs/openapi.yaml), served as Swagger UI on `/docs`.
Press **Authorize** there and paste the token to call the CMS endpoints.

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

Codes: `VALIDATION_ERROR`, `INVALID_JSON` and `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `NOT_FOUND` (404),
`PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415), `INTERNAL_ERROR` (500).

## Try it

```bash
API=http://localhost:3000/api/v1
AUTH='Authorization: Bearer wink-cms-hardcoded-token'

# 1. Create a draft and keep its id.
CREATED=$(curl -s -X POST $API/cms/posts -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":"Hello WiNK","body":"First post","hashtags":["#NodeJS","express"]}')
echo "$CREATED"
ID=$(echo "$CREATED" | sed -E 's/.*"id":"([^"]+)".*/\1/')

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

Some things are not defined in the task, so here is what I went with.

- The blog and the CMS have separate routers. The blog one only reads and always filters by
  `status: published`, so a draft never shows up there: not in the list, not in `total`, not by id
  (it is a 404, same as a post that does not exist). The token is checked once for the whole CMS
  router.
- The author is always Brian Fox and is set on the server. Sending `author` or any other unknown
  field is a 400. No `status` means `draft`, but you can send `published` to publish right away.
  No `hashtags` means `[]`.
- Publishing is `POST /:id/publish`. It is a single MongoDB update with a `status: draft`
  condition. If the post is already published you just get it back, with the same `publishedAt`,
  so the call can be repeated safely.
- Editing is `PATCH /:id` for `title`, `body` and `hashtags` only. It is not in the task, but I
  added it because a CMS where you can't fix a typo is not very useful.
- Hashtags are saved trimmed, lowercased and without `#`, duplicates are dropped. The filter does
  the same with its input, so `#NodeJS` and `nodejs` are one tag. Only letters, digits and `_`
  are allowed.
- With several hashtags (`?hashtags=node,express`) you get posts that have at least one of them.
- The blog is sorted by `publishedAt` (then `_id`), not by creation date.
- Delete is a real delete and works for drafts and published posts.
- The body is stored as is. The API doesn't sanitize it, escaping is up to whoever renders it.
- CORS is open by default (`CORS_ORIGIN=*`), I assume the clients are browser apps on other
  domains.

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

Routes validate the request, the service has the logic, the model is the Mongoose schema.

## Tests

```bash
npm test
```

The tests send HTTP requests to the real app and use a real MongoDB started by
`mongodb-memory-server`. The first run downloads a MongoDB binary, so it needs a network
connection and takes longer.

Other checks: `npm run lint`, `npm run typecheck`, `npm run build`.

## Next steps

Not done, since the task doesn't ask for it: unpublishing, real auth with roles, rate limiting,
proper logging, cursor pagination, CI.
