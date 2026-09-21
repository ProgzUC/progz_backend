# Centralized Notifications

The academy sends both **in-app** and **email** alerts from one dispatcher (`services/notificationService.js`). Event code never talks to SMTP or the Notification collection directly.

## Event types

| Type | When it fires | Email | In-app |
| --- | --- | --- | --- |
| `approval` | Admin approves a registration (or creates the user directly) | Yes | Yes |
| `rejection` | Admin rejects a pending registration | Yes | No (no account yet) |
| `pending_approval` | Someone self-registers | Yes | Yes (admins) |
| `batch_assignment` | Student enrolled or trainer assigned | Yes | Yes |
| `class_reminder` | ~30 minutes before a scheduled class | Yes | Yes |
| `attendance_warning` | Student attendance drops below 75% (min. 3 sessions) | Yes | Yes |
| `admin_event` | Announcements, batch status changes, sync failure, weekly digest | As needed | Yes |

User preference flags (stored on `User.notificationPrefs`) can turn any of those types off, plus master `inAppEnabled` / `emailEnabled`. Admins also have `emailDigest` for the Monday summary.

## HTTP API

All routes require a logged-in user (`protect`).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/notifications` | Latest notices (`?unread=true&limit=40`) |
| `GET` | `/api/notifications/unread-count` | Badge count |
| `PATCH` | `/api/notifications/:id/read` | Mark one read |
| `PATCH` | `/api/notifications/read-all` | Mark all read |
| `GET` | `/api/notifications/preferences` | Current prefs |
| `PUT` | `/api/notifications/preferences` | Save prefs |

## Scheduled jobs

Initialized from `jobs/cronJobs.js`:

- **Every 10 minutes** — class reminders for batches whose `daysOfWeek` + `classTiming` match today, within `CLASS_REMINDER_LEAD_MINUTES` (default 30).
- **18:00 IST daily** — attendance warnings; trainers and admins get a compact in-app summary.
- **Monday 09:00 IST** — admin digest (pending approvals, at-risk students, classes today).

Reminders and weekly warnings are de-duplicated (`dedupKey`) so the same person is not emailed twice for the same class day / ISO week.

## Adding a new event

```js
import { notifyQuiet, NOTIFICATION_TYPES } from "../services/notificationService.js";

notifyQuiet({
  userIds: [user._id],
  type: NOTIFICATION_TYPES.ADMIN_EVENT,
  title: "Something important happened",
  body: "Short explanation.",
  link: "/admin/overview",
  metadata: { entityId },
});
```

`notifyQuiet` never blocks the HTTP response. Failures are logged, not thrown to the client.
