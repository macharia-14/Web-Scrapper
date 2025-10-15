🌐 Web-Scrapper
📊 Overview

The Web-Scrapper is a lightweight web-tracking and analytics system that helps website owners understand how users interact with their sites.
It combines a FastAPI backend with a simple JavaScript tracking script to collect data such as page views, clicks, scrolls, form submissions, performance metrics, and more.
The project also includes tools for real-time analytics, alerting, and data export — all powered by PostgreSQL.


🚀 Key Features

🧩 User Behavior Tracking – Captures clicks, scrolls, form events, errors, and performance data in real time.

🌍 IP Geolocation – Enriches tracked events using IPInfo to provide geographic insights.

📈 Analytics Dashboard – Displays metrics such as pageviews, active users, top pages, and performance stats.

⚠️ Alerts – Create rules that trigger when metrics exceed thresholds (e.g., traffic spikes or errors).

🧾 Data Export – Download analytics as CSV or PDF reports.

🖥️ Multi-Site Management – Add, manage, and monitor multiple websites from one dashboard.

💡 Real-Time Insights – See live data for active sessions, clicks, and page activity.


🧠 System Components
-  Component	Description	Status
-  Backend (FastAPI)	Core API for tracking, analytics, alerts, and export.	✅ 95%
-  Frontend (HTML + JS)	Static dashboard for sites, analytics, alerts, and exports.	🧩 60%
-  Tracking Script	Embedded script for collecting user events.	✅ 95%
-  Alerts System	Rule-based alerts and notifications.	⚙️ 50%
-  Leads Generation	Planned feature for identifying and storing potential leads.	🚧 10%


⚙️ Tech Stack

-  Backend: FastAPI (Python)

-  Database: PostgreSQL (async integration)

-  Frontend: HTML, CSS, and vanilla JavaScript

-  Data Processing: Pandas, AsyncPG

-  Geolocation: IPInfo API

🧾 How It Works

1. Tracking:
   Embed a small JavaScript snippet on your website.
   It automatically collects user interactions and sends them to the backend.

2. Storage & Processing:
   The FastAPI backend stores the events in PostgreSQL, enriches them with IPInfo data, and triggers any alert checks.

3. Analytics & Export:
   Access the analytics dashboard to view reports or download them as CSV/PDF.


🔮 Roadmap

-  Implement full alert evaluation and notification delivery

-  Add user authentication and access control

-  Improve analytics accuracy (bounce rate, session duration)

-  Enhance frontend with charts, filters, and real-time graphs

 Develop lead-generation and CRM integration

 Add caching and rate-limiting for better performance
