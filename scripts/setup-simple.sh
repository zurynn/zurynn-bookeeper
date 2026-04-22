#!/bin/bash
# First-time setup for bookkeeper-simple on the droplet.
# Run once: bash scripts/setup-simple.sh
set -e

SERVER="root@142.93.119.149"
SSH_KEY="${SSH_KEY:-/c/Users/samyc/.ssh/id_ed25519}"
APP_DIR="/opt/zurynn-book-keeper-simple"

echo "==> Creating app directory on $SERVER"
ssh -i "$SSH_KEY" "$SERVER" "mkdir -p $APP_DIR"

echo ""
echo "==> Setting up .env for bookkeeper-simple"
echo "    Enter values when prompted."
echo ""

read -p "DB_PASSWORD (strong password, different from pro): " DB_PASS
read -p "MYSQL_ROOT_PASSWORD: " MYSQL_ROOT
read -p "JWT_ACCESS_SECRET (64+ char random string): " JWT_ACCESS
read -p "JWT_REFRESH_SECRET (different 64+ char random string): " JWT_REFRESH
read -p "COOKIE_SECRET: " COOKIE_SECRET
read -p "FRONTEND_URL (e.g. http://142.93.119.149:8080): " FRONTEND_URL

cat <<ENV | ssh -i "$SSH_KEY" "$SERVER" "cat > $APP_DIR/.env"
NODE_ENV=production
PORT=3001

DB_HOST=mysql
DB_PORT=3306
DB_USER=zurynn
DB_PASSWORD=$DB_PASS
DB_NAME=zurynn_simple
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT

JWT_ACCESS_SECRET=$JWT_ACCESS
JWT_REFRESH_SECRET=$JWT_REFRESH
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

COOKIE_SECRET=$COOKIE_SECRET

FRONTEND_URL=$FRONTEND_URL
VITE_API_URL=$FRONTEND_URL/api
ENV

echo ""
echo "==> Setup complete! Now run: bash scripts/deploy-simple.sh"
