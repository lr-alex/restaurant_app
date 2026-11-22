# Saffron & Stone

Saffron & Stone is a server-side restaurant application built with Express, Mongoose, EJS, and Bootstrap. It includes customer reservations and ordering, a branch-scoped staff workspace, an administrator area, and a session-protected REST API.

All user-facing application text is in English.

## Requirements

- Node.js 20 or later
- An accessible MongoDB Atlas database

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Confirm the shared `.env` configuration is present:

   ```text
   PORT=8099
   MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER/restaurantDB
   SESSION_SECRET=a-long-local-session-secret
   NODE_ENV=development
   ```

   The `.env` file is tracked with the shared course Atlas configuration so collaborators can run the same demo.

3. Reset and seed the project collections:

   ```powershell
   npm run seed
   ```

   This removes only Saffron & Stone records from the collections listed in [Database model](#database-model). It also clears the legacy `booking_schedule` and `order_items` sample collections.

4. Start the application:

   ```powershell
   npm start
   ```

5. Open [http://localhost:8099](http://localhost:8099).

## Demo accounts

| Role | Username | Password | Scope |
|---|---|---|---|
| Customer | `customer1` | `Customer@123` | Own reservations, orders, profile, and favorites |
| Staff | `staff1` | `Staff@123` | Branch 1 orders, reservations, menu, and own schedule |
| Admin | `admin1` | `Admin@123` | Global restaurant configuration |

In development, `/login` also provides one-click Customer, Staff, and Admin buttons. They use the same seeded accounts and are disabled when `NODE_ENV=production`.

Password storage is plaintext in `accounts.password`, per the project's explicit course-demo requirement. Passwords are excluded from API responses by default, but this storage design must not be used in production.

## Main web routes

| Role | Routes |
|---|---|
| Public | `/login` |
| Customer | `/customer/bookings`, `/customer/menu`, `/customer/orders`, `/customer/profile` |
| Staff | `/staff/dashboard`, `/staff/bookings`, `/staff/menu`, `/staff/schedule` |
| Admin | `/admin/dashboard`, `/admin/branches`, `/admin/meals`, `/admin/staff`, `/admin/shifts`, `/admin/suppliers`, `/admin/batches` |
| All signed-in roles | `/account/password`, `POST /logout` |

## Database model

| Collection | Purpose |
|---|---|
| `accounts` | Login username, plaintext demo password, role, and linked profile |
| `customers` | Customer contact details, membership, and favorite meal IDs |
| `staff` | Employee branch, role, profile, salary, and employment state |
| `branches` | Hours, rest day, and configured reservation slots/capacity |
| `meals` | Text menu catalog with category, price, and availability |
| `bookings` | Reservation date, slot, party size, and status |
| `orders` | Customer order with embedded meal snapshots and kitchen status |
| `shifts` | Dated staff working periods |
| `suppliers` | Supplier contacts and descriptions |
| `supply_batches` | Lightweight delivery log |

Reservations and orders are retained when cancelled. Meals, staff, and suppliers with historical references are disabled instead of physically deleted.

## Verification

Run the database-independent tests:

```powershell
npm test
```

The API contract, role rules, request examples, and `curl` commands are documented in [docs/API.md](docs/API.md).

## Technology notes

- Express 4 and server-rendered EJS
- Mongoose models and validation
- In-memory `express-session`; restarting the process signs all users out
- Bootstrap 5 loaded from the local npm package, with custom restaurant styling
- No React, Vue, frontend bundler, payment gateway, image library, or cloud deployment
