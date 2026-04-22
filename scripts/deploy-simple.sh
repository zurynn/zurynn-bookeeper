#!/bin/bash
# Deploy the simple branch to /opt/zurynn-book-keeper-simple on the droplet.
# Usage: bash scripts/deploy-simple.sh
# Must be run from the simple branch: git checkout simple
set -e

SERVER="root@142.93.119.149"
SSH_KEY="${SSH_KEY:-/c/Users/samyc/.ssh/id_ed25519}"
APP_DIR="/opt/zurynn-book-keeper-simple"

# Guard: make sure we're on the simple branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "simple" ]; then
  echo "ERROR: must be on the 'simple' branch (currently on '$BRANCH')"
  echo "       Run: git checkout simple"
  exit 1
fi

echo "==> Packaging simple branch for deployment"

tar --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./deploy' \
    --exclude='./*.zip' \
    --exclude='./client-dist*' \
    --exclude='./server-upload*' \
    --exclude='./server.zip' \
    --exclude='./server/dist' \
    --exclude='./server/logs' \
    --exclude='./server/uploads' \
    --exclude='./.env' \
    --exclude='./scripts' \
    -czf /tmp/zurynn-simple-deploy.tar.gz .

echo "==> Uploading to $SERVER:$APP_DIR"
scp -i "$SSH_KEY" /tmp/zurynn-simple-deploy.tar.gz "$SERVER:/tmp/zurynn-simple-deploy.tar.gz"

echo "==> Extracting and starting containers on server"
ssh -i "$SSH_KEY" "$SERVER" bash <<REMOTE
set -e
mkdir -p $APP_DIR
cd $APP_DIR

tar -xzf /tmp/zurynn-simple-deploy.tar.gz
rm /tmp/zurynn-simple-deploy.tar.gz

mkdir -p server/uploads

# Build TypeScript before Docker picks it up
cd server && npm ci --silent && npm run build && cd ..

docker compose up -d --build

echo ""
echo "Waiting for services to be healthy..."
sleep 12
docker compose ps

echo ""
echo "==> Running database seed (account types)..."
docker compose exec -T backend node -e "require('./dist/db/seeds/index.js')" || echo "Seed already applied or skipped."
REMOTE

rm -f /tmp/zurynn-simple-deploy.tar.gz

echo ""
echo "==> Deployment complete!"
echo "    App:    http://142.93.119.149:8080"
echo "    API:    http://142.93.119.149:3002"
echo "    Logs:   ssh -i $SSH_KEY $SERVER 'cd $APP_DIR && docker compose logs -f'"
