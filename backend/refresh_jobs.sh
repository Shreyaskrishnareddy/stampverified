#!/bin/bash
# Refresh Greenhouse job data daily
# Add to cron: 0 6 * * * /path/to/refresh_jobs.sh
#
# On Render: use Render Cron Jobs (https://render.com/docs/cronjobs)
# On local: crontab -e → 0 6 * * * cd /mnt/d/claude_projects/stampverified/backend && ./refresh_jobs.sh

cd "$(dirname "$0")"

echo "[$(date)] Starting Greenhouse job refresh..."
python3 -m app.services.greenhouse_scraper
echo "[$(date)] Done. Jobs saved to greenhouse_jobs.json"
