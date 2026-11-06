# Beamlock security and privacy

One-pager for Shell reviewers. This describes what the app actually does. It is not a certification.

## What Beamlock is

Beamlock tracks maintenance progress: who is up next, who signed off, and what was commented. It does **not** issue permits, approve permits, or authorize isolations or LOTO. Permit Vision status in the app is a stub and must not be treated as approval.

## Where data lives

- The database and file storage are a Supabase project in **Canada**, region `ca-central-1`.
- The website is static files on GitHub Pages. The browser talks to Supabase with the public anon key only. The service-role key is not in the site.

## Who can do what

Access is enforced in the database with row-level security, not only by hiding buttons.

- A trade account can sign off, skip, and comment on that trade's steps.
- Planner and Supervisor accounts that are still waiting for approval can read jobs and cannot change them.
- An approved planner manages jobs and the maintenance-schedule import. An approved admin manages users and settings.
- An operator may view the app as another role except Admin. The audit log records that as "Operator Name acting as Role".
- Five wrong codes lock that account for 15 minutes. A deactivated account is signed out.

People cannot change their own role. Role and approval live in a profiles table the user cannot update.

## Audit

Sign-offs, holds, comments, reactions, imports, and role changes write an audit row. The database stamps the actor name and role from the signed-in account. The browser does not get to invent that name. A person can add or remove only their own reaction. A reaction means they understand the item is there. It does not approve the work.

## Unit safety

Each unit card can hold the Firehall number, a Security number, a Panel number, muster points, unit phones, showers and eyewash, notes, and a map photo. Signed-in people can read it. Only an admin can change it. Empty fields stay blank until an admin sets them. Site emergency procedures and the official muster system take precedence over the card.

## Photos

Comment photos and voice notes are stored in a private Storage bucket. The browser loads them with short-lived signed links for a signed-in user. They are not a public gallery. A voice note can also be typed or edited before it is saved. On a browser that cannot transcribe speech, the audio is saved without a transcript.

## Notifications

Alerts use the device notification permission while Beamlock is open, and only after the person turns them on from Profile. Background web push is not enabled. iOS only shows these alerts for an installed Home Screen app, and only while the app is in the foreground unless a push service is added later.

## Offline

If the network drops, sign-offs, comments, and photos wait on the device and send when the connection returns. If the server already recorded that step, the server copy is kept and the person is told.

## What this is not

Beamlock does not claim SOC 2, ISO 27001, or permit-system accreditation. Production identity for Shell would still be Microsoft Entra ID, as noted in the integration checklist.
