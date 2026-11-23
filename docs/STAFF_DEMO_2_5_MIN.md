# Staff Demo — 2 minutes 30 seconds

## Before the timer starts

From the `restaurant_app` directory:

```powershell
npm run reset
npm start
```

Open [http://localhost:8099/login](http://localhost:8099/login). Keep the Staff demo account ready:

- Username: `staff1`
- One-click button: **Sign in as Staff**
- Branch: Downtown Room, Branch 1

The reset restores the pre-CRUD state, including one active Branch 1 order, one upcoming Branch 1 reservation, and the staff member's scheduled shift.

## Timed presentation

| Time | Action | Suggested narration |
|---|---|---|
| **0:00–0:10** | Show the login page, then click **Sign in as Staff**. | “This is the staff workspace for Branch 1. One click signs me in with a preconfigured staff account for the demo.” |
| **0:10–0:30** | On **Kitchen**, point to the branch label, live order queue, and next tables panel. | “Staff are restricted to their assigned branch. Here they can see active kitchen orders and upcoming reservations without access to global administration.” |
| **0:30–0:50** | Point to the seeded order card: **Bob Johnson**, Carbonara ×2, Margherita ×1, total $44.48, status **Preparing**. | “The order stores item snapshots and a server-calculated total. The customer cannot submit a forged price, and the kitchen sees exactly what was ordered.” |
| **0:50–1:10** | Change the order status to **Ready**, click **Update**, and show the confirmation and updated badge. | “The staff member advances the order through the kitchen workflow. The status is persisted in MongoDB and will also appear in the customer's order history.” |
| **1:10–1:30** | Open **Reservations** and locate **Bob Johnson** at 19:00–21:00 for 4 guests. | “This is the upcoming reservation for Branch 1. The server already enforced the branch schedule, party-size limit, and remaining capacity when it was created.” |
| **1:30–1:50** | Change that reservation from **Confirmed** to **Completed**, click **Set**, and show the updated status. | “Front-of-house staff can close a completed booking while preserving it for history. Reservations are never physically deleted.” |
| **1:50–2:05** | Open **Menu** and briefly show several categorized, text-only meal cards. | “Staff can consult the current menu and availability, but the page is read-only. Menu changes remain an administrator responsibility.” |
| **2:05–2:20** | Open **My schedule** and show Alice Smith's upcoming shift. | “Each staff member can see their own assigned shifts. Scheduling itself is managed by an administrator.” |
| **2:20–2:30** | Point to the role label and sign out. | “This separates daily branch operations from administration and demonstrates role-based, branch-scoped access.” |

## Backup lines

- If asked about order prices: “The server ignores client-supplied totals and recalculates every subtotal from the current meal records.”
- If asked about scope: “The same staff session can only read Branch 1 orders and bookings. Attempting an administrator page returns Access denied.”
- If asked about history: “Orders and reservations use terminal states such as completed or cancelled instead of physical deletion, preserving the audit trail.”
