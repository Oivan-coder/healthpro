# Атлас здоровья Backend

Lightweight Express API for the Атлас здоровья v5 technical MVP.

## Run

```bash
npm install
npm run dev
```

The API runs on `http://localhost:3001`.

## Notes

Data can be read from MySQL when `USE_DB=mysql`, or from JSON files when `USE_DB=json` / MySQL is unavailable.

## MySQL

```bash
cp .env.example .env
npm install
npm run db:init
npm run db:seed
npm run dev
```

Do not commit real `.env` values. Keep local credentials only on your machine.
