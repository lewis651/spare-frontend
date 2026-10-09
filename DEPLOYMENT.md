# Axlerate deployment checklist

The frontend and API can run on separate hosts or behind one shared domain. The database connection string and public domain still need to be supplied by the site owner.

## Frontend

- Use Node.js 20.19 or newer.
- In `frontend`, run `npm ci` and `npm run build`. Publish the generated `frontend/dist` directory on a static web host.
- If the API has its own domain, set `VITE_API_BASE_URL` to the API origin (for example `https://api.your-domain.com`) in the frontend build environment. Rebuild after setting it.
- If both apps use the same domain, leave `VITE_API_BASE_URL` empty and configure the web host to proxy `/api` to the backend.
- Configure the frontend host to serve `index.html` for `/` and keep the static files in `dist` available at the site root. `axlerate.html`, `chat-widget.js`, `llms.txt`, `robots.txt`, `favicon.svg`, and `assets/` must remain accessible.

## Backend

In `my-backend`, run `npm ci` and `npm start`. Configure these environment variables on the API host:

- `NODE_ENV=production`
- `PORT` to the port supplied by the host (if required)
- `DATABASE_URL` to the hosted PostgreSQL connection string
- `PGSSL=true` when the provider requires TLS
- `ADMIN_USERNAME` and a unique, strong `ADMIN_PASSWORD`
- `FRONTEND_ORIGIN` to the exact public frontend origin, including `https://`; multiple allowed origins can be comma-separated
- `WHATSAPP_ADMIN_NUMBER` to the real WhatsApp number in international digits-only format (for example `14155550123`)

The backend refuses to start in production without `DATABASE_URL`, because the fallback memory store loses orders and chats when the process restarts. It initializes the schema at startup. The API health check is `GET /api/health`.

## Before launch

- Add real production credentials and the database URL only in the host's secret/environment settings. Do not commit `.env` files.
- Set the public frontend domain in `FRONTEND_ORIGIN` and, when using separate hosts, set `VITE_API_BASE_URL` to the API origin.
- Set the real WhatsApp number; otherwise the widget explains that WhatsApp is not configured.
- Check `/api/health`, place a small test order, verify the order in the admin dashboard, test a live chat reply, and confirm WhatsApp opens the configured number.
- Configure a database backup and HTTPS on both frontend and API hosts.
