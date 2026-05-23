#!/bin/bash

# --- GuardianSOC Automated EC2 Deployment Script ---
# This script installs all dependencies and starts the SOC engine.

echo "[1/6] Installing Node.js 20 and PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2 serve

echo "[2/6] Installing Workspace Dependencies..."
npm install

echo "[3/6] Setting up Environment Variables..."
# Note: We use the EC2 IP for the URLs
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is missing."
  echo "Please run: export DATABASE_URL='your_postgres_url' before running this script."
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

echo "[4/6] Building Backend & Frontend..."
npm run build -w backend

# Inject EC2 IP into Frontend build so it knows where the API is
export VITE_API_URL=http://$EC2_IP:3001
export VITE_SOCKET_URL=http://$EC2_IP:3001
npm run build -w frontend

echo "[5/6] Starting SOC Engine (PM2)..."
pm2 delete all 2>/dev/null || true
cd backend
pm2 start dist/server.cjs --name "soc-backend"
cd ..

# Clear port 80 if nginx or something else is holding it
sudo fuser -k 80/tcp 2>/dev/null || true
sudo pm2 serve frontend/dist 80 --name "soc-frontend" --spa

echo "[6/6] Finalizing System..."
pm2 save
sudo pm2 startup | tail -n 1 | bash

echo "============================================"
echo "DEPLOYMENT COMPLETE!"
echo "SOC Dashboard: http://\$EC2_IP"
echo "Backend API: http://\$EC2_IP:3001"
echo "Automation Engine is now ACTIVE."
echo "============================================"
