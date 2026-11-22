# SUKUN MEDHA — Education & Competition Platform

Open to everyone: students, teachers, parents, job seekers, readers, professionals and general participants.

## Stack
- Node.js + Express API
- PostgreSQL persistent database
- JWT member/admin authentication and bcrypt password hashing
- Admin-managed homepage ads, winners, competitions and coin settings
- Server-verified daily quiz and referral coin ledger

## Run locally
1. Install Node.js 20+ and PostgreSQL.
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `JWT_SECRET` and `ADMIN_PASSWORD`.
3. Run `npm install`, then `npm start`.
4. Open `http://localhost:10000`; Admin: `/admin`; Member: `/member.html`.

The server applies `schema.sql` automatically on startup.

## Render deployment
Create a Blueprint from this repository using `render.yaml`. Set a strong `ADMIN_PASSWORD` when prompted. Render provisions PostgreSQL and connects it through `DATABASE_URL`. Keep the database attached to the web service and never publish secrets in GitHub.

After deployment, check `/api/health`; it should return `database: connected`. Sign in at `/admin`.

## Included
- Responsive public homepage with two Admin-managed banner slots (below header and below quiz).
- Winner showcase with name, photo, position, competition and details.
- Universal member registration/login with multiple identity types.
- Referral link and referral tracking.
- Daily five-question quiz; the server stores attempts and validates submitted answers.
- Quiz coins and referral rewards stored in PostgreSQL coin transactions. One daily quiz attempt per member is enforced.
- Admin console for ads, winners, competitions, members, referrals, coin settings and JSON backup.
- PostgreSQL-backed public content shared across devices.

## Production notes
- Use a strong unique Admin password and keep `JWT_SECRET` private.
- Configure automated PostgreSQL backups in Render.
- The daily quiz currently uses a small starter question set; expand it into a full Admin-managed question bank before public launch.
- Coins are promotional points, not cash; they cannot be withdrawn or transferred.
- Paid-entry competitions, payment collection and prize structures need separate legal and operational review. Do not use pooled entry fees or chance-based prize mechanics.
- This is a deployable foundation, not yet a complete payment gateway, certificate-verification or full exam-management product.
