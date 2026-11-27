# COMP 3810SEF

# Project Information

## Project name

**Saffron & Stone \- Restaurant Management Application**

## Project description

Saffron & Stone is a server-rendered restaurant application for customers, branch staff, and administrators. Customers can sign in, manage reservations, browse meals, and place orders. Staff can manage orders and reservations for their assigned branch. Administrators manage restaurant branches, meals, staff, schedules, suppliers, and supply batches.

The application is built with Node.js, Express, MongoDB/Mongoose, EJS, and Bootstrap. It includes both browser-based pages and a session-authenticated JSON REST API.

## Group information

Group Number: 53

| Student name | SID | Workload |
| :---- | ----: | :---- |
| Kwok Ka Yu Matthew | 14585487 | Database designer / debugger |
| Lu Hang Yuen Alex | 13615185 | Coder |
| Chan Sung Ming William | 14480597 | RESTful coder |
| CHO Suet Yuki | 13618869 | Document writer |

## Project file introduction

| File or folder | Purpose |
| :---- | :---- |
| `server.js` | Connects to MongoDB, starts the Express server, and closes the server/database connection during shutdown. |
| `app.js` | Configures Express, EJS, sessions, middleware, static files, web routes, API routes, and error responses. |
| `package.json` | Lists project dependencies, the Node.js version requirement, and commands such as `npm start`, `npm run reset`, `npm test`, and `npm run test:api`. |
| `config/` | Loads environment settings and creates/closes the MongoDB connection. |
| `models/` | Defines Mongoose models for accounts, customers, staff, branches, meals, bookings, orders, shifts, suppliers, and supply batches. |
| `routes/` | Implements login, customer, staff, administrator, and REST API routes. |
| `services/` | Contains shared reservation and order rules used by the application routes. |
| `middleware/` | Handles authentication, role checks, current-user information, and flash messages. |
| `views/` | EJS templates for login and customer, staff, and administrator pages. |
| `public/` | Static browser assets, including the application stylesheet and JavaScript. |
| `utils/` | Shared error handling, asynchronous route handling, and date utilities. |
| `scripts/` | Database reset and end-to-end API test scripts. |
| `tests/` | Automated model, date-validation, and login-template tests. |
| `docs/` | API reference and manual API walkthrough. See [docs/API.md](docs/API.md) and [docs/speed.txt](docs/speed.txt). |
| `.env` | Local runtime configuration, including the MongoDB connection string and session secret. Do not publish real credentials. |

# Operation Guides for the Server

## Requirements and setup

- Node.js 20 or later
- Access to a MongoDB database
- PowerShell (the examples below use Windows PowerShell)
1. Open a terminal in the project folder and install dependencies:

   ```powershell

   npm install

   ```

2. Create or check the `.env` file in the project root. Provide your own database URI and a long, private session secret:

```
PORT=8099
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER/restaurantDB
SESSION_SECRET=replace-with-a-long-random-secret
NODE_ENV=development
```

   `MONGODB_URI` and `SESSION_SECRET` are required. `PORT` defaults to `8099` and `NODE_ENV` defaults to `development`.

3. Optional: restore the course demo data:

   ```powershell

   npm run reset

   ```

   Run this only when it is safe to reset the records in the database configured by `MONGODB_URI`. Do not run it against production data.

4. Start the server:

   ```powershell

   npm start

   ```

   A successful start connects to MongoDB and prints the server URL. Open [http\://localhost:8099/login](http://localhost:8099/login) (replace `8099` if you configured a different port). Press `Ctrl+C` in the terminal to stop the server.

5. To run the database-independent automated tests, use a second terminal:

   ```powershell

   npm test

   ```

## Login and logout

The demo accounts below are available when the demo data has been set up:

| Role | Username | Password | Access |
| :---- | :---- | :---- | :---- |
| Customer 1 | `customer1` | `Customer@123` | Own reservations, orders, profile, and favorites |
| Customer 2 | `customer2` | `Customer2@123` | Own reservations, orders, profile, and favorites |
| Staff 1 | `staff1` | `Staff@123` | Branch 1 orders, reservations, menu, and own schedule |
| Staff 2 | `staff2` | `Staff2@123` | Branch 2 orders, reservations, menu, and own schedule |
| Administrator | `admin1` | `Admin@123` | Restaurant-wide administration |

To sign in, open `/login`, enter a username and password, and submit the form. In development mode, the login page also provides demo sign-in buttons. After authentication, the application opens the home page for the account's role. Use **Sign out** in the navigation to end the session. Signed-in users can change their password at `/account/password`.

These are demo credentials, not production credentials. The course demo stores passwords as plaintext, so this application and its demo accounts must not be used as a production authentication system.

## Using the web pages

### Customer pages

Sign in as a customer to use:

- `/customer/bookings` - view reservations and create a reservation.
- `/customer/bookings/:id/edit` - edit an active reservation; use the cancel action to cancel it.
- `/customer/menu` - choose an open branch, browse available meals, manage the cart, and place an order.
- `/customer/orders` - view your order history.
- `/customer/profile` - update your profile and manage favorite meals.

Reservations and orders are retained as history rather than physically deleted. Customers can cancel an active reservation; ask staff about an order status change.

### Staff pages

Sign in as a staff account to use:

- `/staff/dashboard` - view and update orders for your assigned branch.
- `/staff/bookings` - view branch reservations and update their statuses.
- `/staff/menu` - view the menu (read-only).
- `/staff/schedule` - view your own upcoming shifts.

Staff access is restricted to their assigned branch; staff cannot manage another branch's records.

### Administrator pages and CRUD

Sign in as `admin1` to open `/admin/dashboard`. The administrator pages provide these record-management operations:

| Page | Create | Read | Update | Delete / archive behavior |
| :---- | :---- | :---- | :---- | :---- |
| `/admin/branches` | Add a branch | List branches | Edit branch details and operating status | Delete only if no records refer to it; otherwise disable it. |
| `/admin/meals` | Add a meal | List all meals | Edit meal details, price, and availability | Delete if there is no order history; otherwise the meal is disabled. |
| `/admin/staff` | Add a staff profile and login | List staff | Edit details or deactivate the account | Deactivate rather than physically delete. |
| `/admin/shifts` | Schedule a shift | List shifts | Re-create a shift if its details need changing | Remove a shift. |
| `/admin/suppliers` | Add a supplier | List suppliers | Edit details or deactivate | Delete if there is no supply history; otherwise deactivate. |
| `/admin/batches` | Record a supply batch | List batches | Not available on this page | Remove a batch record. |

The administrator dashboard also summarizes branch, meal, staff, booking, and order activity. Validation errors and success messages appear in the page.

# Use of the RESTful CRUD Services

## API overview

The API is mounted at `/api`, returns JSON, and uses the same session authentication as the web application. Except for `POST /api/session` (sign in), API requests require an authenticated session cookie. The API enforces role permissions and customer/branch record scope.

| Resource | Method and path | Access and purpose |
| :---- | :---- | :---- |
| Session | `POST /api/session` | Public; sign in and receive a session cookie. |
| Session | `GET /api/session` | Any signed-in user; get the current account. |
| Session | `DELETE /api/session` | Any signed-in user; sign out. |
| Branches | `GET /api/branches` | Any signed-in user; list branches that are not disabled. Read-only through the API. |
| Meals | `GET /api/meals`, `GET /api/meals/:id` | Any signed-in user; customers and staff see available meals, administrators see all meals. |
| Meals | `POST /api/meals`, `PATCH /api/meals/:id`, `DELETE /api/meals/:id` | Administrator; create, update, and delete a meal. A meal referenced by order history cannot be deleted; disable it with `isAvailable: false`. |
| Bookings | `GET /api/bookings`, `GET /api/bookings/:id` | Any signed-in user; customers see their own, staff see their branch, administrators see all. Supports `status` and `branchNo` filters. |
| Bookings | `POST /api/bookings` | Customer; create a reservation. |
| Bookings | `PATCH /api/bookings/:id` | Customer can edit their active reservation or cancel it; staff/admin can update its status within their access scope. |
| Bookings | `DELETE /api/bookings/:id` | Disabled (`405`); cancel the reservation instead. |
| Orders | `GET /api/orders`, `GET /api/orders/:id` | Any signed-in user; customers see their own, staff see their branch, administrators see all. Supports `status` and `branchNo` filters. |
| Orders | `POST /api/orders` | Customer; create an order. The server calculates prices and the total from current meal records. |
| Orders | `PATCH /api/orders/:id` | Staff/admin; update the kitchen status within their access scope. |
| Orders | `DELETE /api/orders/:id` | Disabled (`405`); orders are retained as history. Staff/admin update order status through `PATCH`. |

The API is not full CRUD for every resource: branches are read-only, and bookings/orders preserve history rather than supporting physical deletion. See [docs/API.md](docs/API.md) for request fields, response examples, validation rules, status codes, and complete request samples.

## Testing the API with PowerShell

Start the server first. The commands below use PowerShell-native REST cmdlets so JSON quoting is handled safely.

1. Sign in as a customer:

   ```powershell

   $base = "http://localhost:8099"
   $customer = New-Object Microsoft.PowerShell.Commands.WebRequestSession
   $loginBody = @{
     username = "customer1"
     password = "Customer@123"
   } | ConvertTo-Json -Compress
   $customerLogin = Invoke-RestMethod `
     -Method Post `
     -Uri "$base/api/session" `
     -WebSession $customer `
     -ContentType "application/json" `
     -Body $loginBody

   ```

   A successful sign-in returns `201 Created` and a JSON account summary.

2. List available meals:

   ```powershell

   $meals = (Invoke-RestMethod `
     -Method Get `
     -Uri "$base/api/meals" `
     -WebSession $customer).data

   ```

3. List branches:

   ```powershell

   $branches = (Invoke-RestMethod `
     -Method Get `
     -Uri "$base/api/branches" `
     -WebSession $customer).data

   ```

4. Create a reservation using a future date, an active branch, and one of that branch's configured booking slots:

   ```powershell

   $bookingBody = @{
     branchNo = 1
     bookingDate = "YYYY-MM-DD"
     slotStart = "19:00"
     slotEnd = "21:00"
     partySize = 2
     notes = "Window table if available"
   } | ConvertTo-Json -Compress
   $booking = Invoke-RestMethod `
     -Method Post `
     -Uri "$base/api/bookings" `
     -WebSession $customer `
     -ContentType "application/json" `
     -Body $bookingBody

   ```

   Replace `YYYY-MM-DD` with a future date. Confirm the branch and slot values using `GET /api/branches`; the example slot is only valid if it is configured for Branch 1. The server checks availability, operating status, capacity, date, and duplicate reservations.

5. Sign out and clear the session:

   ```powershell

   $logout = Invoke-WebRequest `
     -Method Delete `
     -Uri "$base/api/session" `
     -WebSession $customer `
     -UseBasicParsing
   $logout.StatusCode

   ```

Successful requests typically return a JSON object with a `data` field; sign-out returns `204 No Content`. Errors return JSON with an `error` field. Common status codes include `400` for invalid input, `401` for no valid session, `403` for a role or ownership violation, `404` for a missing/out-of-scope record, `405` for a disabled operation, and `409` for a conflict.

For administrator-only API requests, create a separate `$admin` WebRequestSession and sign in with `admin1`. Replace `MEAL_ID` in the examples in [docs/API.md](docs/API.md) with a meal ID from `GET /api/meals`. Keep role sessions separate and do not share active session cookies.
