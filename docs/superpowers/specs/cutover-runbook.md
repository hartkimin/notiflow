# Supabase Cloud Cutover Runbook

Execute when Cloud has been validated through multiple successful sync runs.

## Pre-cutover checklist
- [ ] At least 3 successful `npm run sync:cloud` runs with matching row counts
- [ ] Cloud Edge Functions responding correctly
- [ ] Push notifications working on Cloud
- [ ] Clinic staff notified of maintenance window + session re-login required
- [ ] Verify no Vercel cron is scheduled in the next 30 minutes (cron times: 14:50, 16:00, 18:00, 19:00 UTC)

## Cutover steps

### 1. Maintenance mode
Enable Vercel maintenance page or deploy a temporary "System maintenance" build.

### 2. Drain in-flight requests
Wait ~30 seconds after last user activity.

### 3. Final sync
```bash
npm run sync:cloud
```
Note: this is the last time local data goes to Cloud.

### 4. Update `apps/web/.env.local`
Replace local values with Cloud values (see `apps/web/.env.cloud.example`):
- `NEXT_PUBLIC_SUPABASE_URL` → `https://<cloud-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Cloud anon key
- `SUPABASE_SERVICE_ROLE_KEY` → Cloud service role key

### 5. Update Vercel environment variables
Supabase dashboard → Settings → API → copy URL, anon key, service_role key.
Vercel dashboard → Project → Settings → Environment Variables.
Update the three Supabase variables for Production environment.

### 6. Redeploy on Vercel
Trigger a new deployment (push empty commit or trigger via Vercel dashboard).

### 7. Rebuild Android APK
Update `apps/mobile/local.properties`:
```
SUPABASE_URL=https://<cloud-ref>.supabase.co
SUPABASE_KEY=<cloud-anon-key>
```
Build and distribute:
```bash
cd apps/mobile
./gradlew assembleRelease
```
⚠️ Distribute APK to ALL clinic devices before step 9. Devices with old APK will fail to connect after local Supabase is stopped.

### 8. Smoke test
- [ ] Web app loads and user can log in (re-login required — JWT secret changed)
- [ ] Create a test order end-to-end
- [ ] Parse a test message via AI pipeline
- [ ] Realtime subscription fires on status change
- [ ] Push notification delivered to test device
- [ ] Android device (updated APK) connects and syncs

### 9. Remove maintenance mode
Re-enable normal Vercel deployment.

### 10. Stop local Supabase
```bash
npm run supabase:stop
```

## Rollback (if Cloud has issues during cutover)
1. Re-enable maintenance mode.
2. Revert `apps/web/.env.local` to local Supabase values (URL: `http://127.0.0.1:54321`).
3. Restart local: `npm run supabase:start`
4. Revert Vercel env vars and redeploy.
5. Rollback Android APK distribution if already pushed.
