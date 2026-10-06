# NA Garments API

Backend REST API for the NA Garments tailoring and e-commerce platform. It is built with Express and TypeScript, uses PostgreSQL through Prisma, and generates its routes and OpenAPI documentation with tsoa.

## Requirements

- Node.js
- pnpm 11.3 or compatible
- PostgreSQL

## Configuration

Set the environment variables in the process environment or your deployment platform. The application does not automatically load a `.env` file.

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. |
| `JWT_SECRET` | Yes | Secret used to sign and verify JWTs. |
| `JWT_EXPIRES_IN` | No | Token lifetime; defaults to `7d`. |
| `PORT` | No | HTTP port; defaults to `5000`. |
| `FRONTEND_URL` | No | Allowed CORS origin and password-reset link origin; defaults to `https://na-garments-frontend.vercel.app`. |
| `PAYMENT_PENDING_TIMEOUT_MINUTES` | No | Time before an unanswered pending payment can be retried; defaults to `15` minutes. |
| `CLOUDINARY_CLOUD_NAME` | For image uploads | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | For image uploads | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | For image uploads | Cloudinary API secret. |
| `PAYPACK_CLIENT_ID` | For Paypack payments | Paypack client ID. |
| `PAYPACK_CLIENT_SECRET` | For Paypack payments | Paypack client secret. |
| `EMAIL_HOST` | For email | SMTP host; defaults to `smtp.gmail.com`. |
| `EMAIL_PORT` | For email | SMTP port; defaults to `465`. |
| `EMAIL_SECURE` | For email | Set to `true` to enable secure SMTP. |
| `EMAIL_USER` | For email | SMTP username. |
| `EMAIL_PASS` | For email | SMTP password. |
| `EMAIL_FROM` | No | Sender address; defaults to the `na-garments` name and `EMAIL_USER`. |
| `ADMIN_EMAIL` | For database seeding | Initial admin email; the seed script has a fallback if unset. |
| `ADMIN_PASSWORD` | For database seeding | Initial admin password; set a strong value before seeding. |

## Getting Started

Install dependencies:

```sh
pnpm install
```

Set `DATABASE_URL` and `JWT_SECRET`, then generate the Prisma client and apply the committed migrations:

```sh
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

To create the initial admin and insert the sample categories and products, first set `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run:

```sh
pnpm exec prisma db seed
```

Start the development server:

```sh
pnpm dev
```

The API listens on port `5000` by default. Check `http://localhost:5000/health` for service status and open `http://localhost:5000/docs` for interactive Swagger documentation.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Regenerates tsoa routes when controllers or interfaces change and runs the development server. |
| `pnpm tsoa:gen` | Generates Express routes and the OpenAPI specification. |
| `pnpm build` | Generates tsoa output and compiles TypeScript. |
| `pnpm start` | Starts the compiled server from `dist/src/server.js`. |

## API Overview

All application routes are listed in Swagger at `/docs`. The main route groups are:

| Prefix | Functionality |
| --- | --- |
| `/auth` | Registration, login, current-user details, and password reset. |
| `/categories` | Browse and administer product categories. |
| `/products` | Product catalog, product options, and product administration. |
| `/cart` | Manage the authenticated customer's cart. |
| `/orders` | Place orders, view customer orders, and administer order statuses. |
| `/payments` | Initiate and inspect payments, receive Paypack webhooks, and administer payment status. |
| `/stock` | Manage product stock entries. |
| `/wishlist` | Manage the authenticated customer's wishlist. |
| `/health` | Check API availability. |

Protected endpoints use a bearer JWT. Admin-only and customer-only access is enforced on the relevant routes; see Swagger for each operation's requirements and request/response schemas.

## Database

The Prisma schema and committed migrations are in `prisma/`. The seed script creates an admin account and sample product categories and products. For local schema development, use `pnpm exec prisma migrate dev`; for applying committed migrations in a deployment, use `pnpm exec prisma migrate deploy`.