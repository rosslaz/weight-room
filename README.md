# Weight Room

A phone-first workout logbook. An admin schedules workouts by date; everyone else opens the app, sees the day's
exercises, and logs weight and reps for each set. Last session's numbers for the same exercise show faintly in each
box as the suggestion. Tap the check to accept them, or type over them.

- **Hosting:** Vercel (static Vite build, deploys on every push to `main`)
- **Data and sign-in:** Supabase project "Workout Tracker" (`pminqbepjktujzrahrbd`), emailed 6-digit codes
- **Offline:** the app shell, the coming week's workouts, and your history are kept on the phone. Sets logged with no
  signal are queued and upload when the phone reconnects.

## Who can do what

Enforced by row-level security in the database, not just the UI:

| | Player | Admin |
|---|---|---|
| See workouts and exercises | ✓ | ✓ |
| Log and see **their own** sets | ✓ | ✓ |
| See other people's sets | | |
| Create/edit workouts and exercises | | ✓ |
| See the people list, grant admin | | ✓ |

The first account to sign in becomes admin.

## Run locally (PowerShell)

```powershell
npm install
npm run dev
```

The Supabase URL and publishable key are built in (`src/lib/supabase.ts`); override with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` in a `.env.local` file. `VITE_APP_NAME` changes the app name.

## Database

Schema changes live in `supabase/migrations`, in the order they were applied.

Key pieces:
- `set_logs`: one row per set. A trigger copies the exercise and date from the workout, so history survives if the
  workout is later edited or deleted.
- `previous_sets(exercise_ids, before_date)`: your most recent session of each exercise before a date. This powers
  the suggestions.
- Exercises with history can be archived but not deleted.

## Regenerate app icons

```powershell
node scripts/icons.mjs
```
