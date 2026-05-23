#!/bin/bash

# --- GuardianSOC Optimized EC2 Deployment Script ---
# This version skips redundant installs and uses faster build patterns.

echo "[1/6] Checking Prerequisites..."
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js $(node -v) is already installed."
fi

if ! command -v pm2 &> /dev/null; then
    echo "PM2 not found. Installing..."
    sudo npm install -g pm2 serve
else
    echo "PM2 $(pm2 -v) is already installed."
fi

echo "[2/6] Syncing Workspace Dependencies..."
# Use --prefer-offline to speed up installs if nodes_modules already exists
npm install --no-audit --no-fund --prefer-offline

echo "[3/6] Configuring Environment..."
# Try multiple ways to get the public IP
EC2_IP=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4)
if [ -z "$EC2_IP" ]; then
  EC2_IP=$(curl -s --connect-timeout 2 ifconfig.me)
fi
if [ -z "$EC2_IP" ]; then
  EC2_IP=$(hostname -I | awk '{print $1}')
fi

echo "Public Endpoint: $EC2_IP"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is missing. Please export it before running."
  exit 1
fi

cat <<EOF > backend/.env
PORT=3001
NODE_ENV=production
FRONTEND_URL=http://\$EC2_IP
APP_URL=http://\$EC2_IP:3001
DATABASE_URL=\$DATABASE_URL
DEFAULT_ALERT_RECIPIENT=kamleshgawade786@gmail.com
EOF

echo "[4/6] Initializing Database & Compiling Assets..."
echo "-> Syncing Database Schema..."
npm run init-db -w backend

echo "-> Compiling Backend Engine..."
npm run build -w backend

echo "-> Compiling Frontend GUI (This may take 1-3 minutes)..."
cat <<EOF > frontend/.env
VITE_API_URL=http://$EC2_IP:3001
VITE_SOCKET_URL=http://$EC2_IP:3001
EOF
npm run build -w frontend
rm frontend/.env

echo "[5/6] Orchestrating SOC Services (PM2)..."
# Smart restart: check if already running, otherwise start fresh
pm2 delete soc-backend soc-frontend 2>/dev/null || true
sudo fuser -k 3001/tcp 2>/dev/null || true
sudo fuser -k 80/tcp 2>/dev/null || true

cd backend
pm2 start dist/server.cjs --name "soc-backend"
cd ..
sudo pm2 serve frontend/dist 80 --name "soc-frontend" --spa

echo "[6/6] Finalizing Stability..."
pm2 save
# Only run startup if not already configured
if ! grep -q "pm2" /etc/rc.local 2>/dev/null; then
    sudo pm2 startup | tail -n 1 | bash
fi

echo "============================================"
echo "DEPLOYMENT OPTIMIZED & COMPLETE!"
echo "SOC Dashboard: http://$EC2_IP"
echo "Backend API: http://$EC2_IP:3001"
echo "Registry Status: OPERATIONAL"
echo "============================================"
