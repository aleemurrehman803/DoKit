# DoKit Firestore Backup Runbook

**Project:** dokit-app-2e81d | **Region:** asia-south1 | **Plan:** Spark (free)

## Why This Exists
Audit C1: No Firestore backup exists. A data-loss event is currently unrecoverable.
On Spark plan, scheduled automatic exports are NOT available (requires Blaze).
This runbook defines the manual backup procedure.

## Backup Schedule
- **Frequency:** Weekly (every Sunday)
- **Retention:** Keep last 4 weekly backups
- **Owner:** Malik Jalil (project owner)

## Manual Backup Procedure

### Prerequisites
- Google Cloud SDK (`gcloud`) installed
- Authenticated as project owner: `gcloud auth login`
- Project set: `gcloud config set project dokit-app-2e81d`

### Steps

1. **Create a Cloud Storage bucket** (one-time):
   ```bash
   gsutil mb -l asia-south1 gs://dokit-app-2e81d-backups/
   ```

2. **Run the export** (weekly):
   ```bash
   EXPORT_DATE=$(date +%Y%m%d)
   gcloud firestore export gs://dokit-app-2e81d-backups/$EXPORT_DATE \
     --project=dokit-app-2e81d
   ```

3. **Verify the export:**
   ```bash
   gsutil ls gs://dokit-app-2e81d-backups/$EXPORT_DATE/
   ```
   Should show export metadata files.

4. **Clean old backups** (keep last 4):
   ```bash
   gsutil ls gs://dokit-app-2e81d-backups/ | head -n -4 | xargs -I {} gsutil -m rm -r {}
   ```

5. **Log the backup:**
   Record date, size, and verification in the backup log below.

## Restore Procedure

**WARNING:** Restore overwrites the entire database. Use with extreme caution.

1. **Stop all writes:** Enable maintenance mode via admin panel.
2. **Run the import:**
   ```bash
   gcloud firestore import gs://dokit-app-2e81d-backups/[DATE] \
     --project=dokit-app-2e81d
   ```
3. **Verify:** Check critical collections (users, deposits, withdrawals).
4. **Disable maintenance mode.**

## Backup Log

| Date | Size | Verified | By |
|------|------|----------|----|
|      |      |          |    |

## Upgrade Path
When revenue justifies it, upgrade to Blaze plan and set up:
- Scheduled exports via Cloud Scheduler + Cloud Functions
- Multi-region replication
- Point-in-time recovery (PITR)

---
*Created: Oct 9, 2026 (Audit Batch 3 - C1)*
*Next review: Jan 9, 2027*
