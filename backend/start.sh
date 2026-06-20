#!/bin/sh
set -e
echo "==> Running database migration..."
npx prisma db push --accept-data-loss
echo "==> Seeding (non-fatal)..."
node prisma/seed.js || echo "==> Seed skipped or already done"
echo "==> Starting server..."
exec node server.js
