# Weather Decision AI

An AI-powered app that analyzes historical weather patterns to help construction
teams assess climate risks and plan project start dates.

## Getting started

Use Node.js 24.12.0 or later, then install dependencies and configure the local
environment:

```bash
npm ci
copy .env.example .env.local
```

Fill `.env.local` with the Firebase Web SDK values, Firebase Admin credentials,
and `GEMINI_API_KEY`. Keep Admin credentials and the Gemini key server-side;
never prefix them with `NEXT_PUBLIC_`. For local Google Cloud development,
Application Default Credentials can replace the service-account environment
variables.

Configure Google sign-in in Firebase Authentication and create the Firestore
database. User roles (`basic`, `approver`, `admin`) are stored in the `users`
collection; privileged roles must be assigned through a trusted administrative
process, not by the user-facing app.

Page access:

- `/` is public. Ticket status counters are shown only to `approver` and `admin`.
- `/meus-chamados` and `/ai-chat` require any signed-in user.
- `/analise-chamados` is limited to `approver` and `admin`.
- `/gerenciamento` and its `/acompanhamento` alias are limited to `admin`.

Run the app locally with `npm run dev`. Checks available before deployment:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Production readiness

- Review `.env.example` and configure secrets in the hosting provider.
- Verify Firebase Authentication providers, Firestore indexes, and
  `firestore.rules` in a non-production project before publishing them.
- Set up monitoring and budget alerts for Gemini and hosting usage. API rate
  limits are per user; they are not a global spending cap.
- Ticket analysis currently runs synchronously in a Next.js request. Confirm
  the hosting platform's maximum request duration can accommodate geocoding,
  historical weather retrieval, and Gemini generation. A durable external
  queue is not configured.
- An interrupted processing run can be retried manually from ticket management
  after its 15-minute lock expires; there is no automatic queue or retry worker.
- The project has not been deployed. Do not deploy Firestore rules or
  application changes until they have been reviewed against the target Firebase
  project.

Weather data is historical and does not guarantee future conditions or
construction outcomes. Construction recommendations require review by a
qualified professional.
