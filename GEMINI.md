# GuardianSOC Project Documentation - May 24, 2026

## 🚀 Core Concept
**GuardianSOC** is an automated Security Operations Center (SOC) platform designed to ingest security alerts (primarily via email), analyze them using the "Syric" AI engine, and manage the incident lifecycle through a unified dashboard.

### Key Workflows:
1.  **Ingestion:** Automatically polls Gmail accounts for security alerts.
2.  **Creation:** Converts emails into structured incidents with a sequential ID (`SOC-1-2026`).
3.  **Analysis:** Enriches incidents with Threat Intelligence and AI-generated insights (Syric).
4.  **Notification:** Sends branded alert emails to SOC operatives with interactive action buttons.
5.  **Lifecycle:** Allows operatives to acknowledge, investigate, escalate, or close incidents directly from the web dashboard or via interactive email links.

---

## 🛠️ Major Changes (Session May 24, 2026)

### 1. Sequential Ticket ID System
*   **Previous:** Generated random 4-digit numbers (e.g., `SOC-3351-2026`).
*   **Updated:** Implemented a strictly sequential system (e.g., `SOC-1-2026`). 
*   **Intelligence:** The system now ignores old 4-digit random IDs to ensure the new sequence starts correctly at `SOC-1`.

### 2. Consolidated Automation Engine
*   **Issue:** Multiple services were overlapping, causing Gmail "Command failed" errors due to concurrent connections.
*   **Fix:** Refactored `queueService.ts` to be the single master orchestrator. It intelligently chooses between **BullMQ (Redis)** or a **Native Interval Fallback** (if Redis is offline) so that only one ingestion process ever runs.

### 3. Admin Email Management Module
*   **New Feature:** Admins can now change the system's Gmail ID and App Password directly from the **HQ Command Center > Mail Automation** tab.
*   **Security:** Passwords are never overwritten with empty values; they are only updated if a new one is explicitly provided.

### 4. Interactive Email Deep-Linking
*   **Enhanced Alert Buttons:** "View Detailed Alert", "Update", "Close", and "Escalate" buttons in alert emails are now fully functional.
*   **Dashboard Auto-Open:** The dashboard now supports query parameters (`?incidentId=...`) to automatically open the specific incident when clicked from an email.

### 5. Stability & Resilience
*   **Redis Resilience:** Hardened the server to prevent crashes when Redis is missing.
*   **Database SSL:** Fixed connection crashes related to self-signed certificates in the Aiven PostgreSQL environment.
*   **Gmail Protocol:** Disabled `qresync` to ensure 100% compatibility with Gmail IMAP.

---

## 🔑 Access Information (Current Dev State)
*   **Admin Email:** `kamleshgawde1@gmail.com`
*   **Initial Password:** `Admin@123`
*   **Backend Port:** `3001`
*   **Frontend Port:** `5173`

## 📋 Future Roadmap
*   Transition "Syric" from mock logic to real LLM integration.
*   Expand "ThreatMap" to visualize geo-location of IP alerts.
*   Implement real-time collaboration indicators for multiple operatives.
