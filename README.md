<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# GuardianSOC Dashboard

A Security Operations Center dashboard migrated to PostgreSQL.

## Run Locally

**Prerequisites:** Node.js (v18+)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Ensure your `.env` file contains the `DATABASE_URL` (I have already created this for you with your Aiven PostgreSQL string):
   ```env
   DATABASE_URL=postgres://avnadmin:...@pg-...aivencloud.com:12639/defaultdb?sslmode=require
   ```

3. **Initialize Database:**
   If you haven't already, run the schema initialization script:
   ```bash
   npx tsx scripts/init-db.ts
   ```
   *Note: If you encounter SSL/TLS errors on Windows, run:*
   `$env:NODE_TLS_REJECT_UNAUTHORIZED='0'; npx tsx scripts/init-db.ts`

4. **Start the App:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## Deployment (Go Live)

The easiest way to take this app live is using **Render** or **Railway**.

### Option 1: Render.com (Recommended)
1.  **Push your code to GitHub.**
2.  Log in to [Render](https://render.com).
3.  Click **New +** > **Web Service**.
4.  Connect your GitHub repository.
5.  Set the following settings:
    *   **Runtime:** `Node`
    *   **Build Command:** `npm install && npm run build`
    *   **Start Command:** `node dist/server.cjs`
6.  Add **Environment Variables**:
    *   `DATABASE_URL`: (Your Aiven PostgreSQL URL)
    *   `NODE_ENV`: `production`

### Option 2: Docker
If you prefer Docker, I have included a `Dockerfile`.
1.  Build: `docker build -t guardiansoc .`
2.  Run: `docker run -p 3000:3000 -e DATABASE_URL="your_url" guardiansoc`
