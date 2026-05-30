# README

## About

This is the official Wails React-TS template.

You can configure the project by editing `wails.json`. More information about the project settings can be found
here: https://wails.io/docs/reference/project-config

## PostgreSQL Setup (Windows, Local)

This project already uses GORM + PostgreSQL. The app reads `DATABASE_URL` from `.env` and connects during startup.

### 1) Create a database and user

Open `psql` as a PostgreSQL superuser and run:

```sql
CREATE USER tenet_user WITH PASSWORD 'change_this_password';
CREATE DATABASE tenet OWNER tenet_user;
GRANT ALL PRIVILEGES ON DATABASE tenet TO tenet_user;
```

### 2) Configure environment variables

Copy values from `.env.example` into `.env` and update:

```env
DATABASE_URL=postgres://tenet_user:change_this_password@localhost:5432/tenet?sslmode=disable
```

Notes:
- If the password has special characters, URL-encode it.
- Keep `sslmode=disable` for local development unless your local server is configured for SSL.

### 3) Start the app

```bash
wails dev
```

Expected behavior:
- Successful DB connect logs: `Database connected and migrations applied`
- Missing DB config logs: `DATABASE_URL is not set; running without database-backed features`

### 4) Verify DB-backed features

After logging in, session operations (list/create/rename/delete) should work without a `database not connected` error.

## Troubleshooting

- `password authentication failed for user`
Use the correct username/password in `DATABASE_URL` and verify the user exists.

- `dial tcp ... connect: connection refused`
PostgreSQL service is not running or host/port is wrong.

- `database "tenet" does not exist`
Create the database first and confirm the exact name in `DATABASE_URL`.

- SSL-related connection errors
For local development, use `?sslmode=disable` unless your server requires SSL.

## Live Development

To run in live development mode, run `wails dev` in the project directory. This will run a Vite development
server that will provide very fast hot reload of your frontend changes. If you want to develop in a browser
and have access to your Go methods, there is also a dev server that runs on http://localhost:34115. Connect
to this in your browser, and you can call your Go code from devtools.

## Building

To build a redistributable, production mode package, use `wails build`.
