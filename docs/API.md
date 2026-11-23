# Saffron & Stone API

The API returns JSON and uses the same session cookie as the EJS application.

## Session authentication

### Sign in

`POST /api/session`

```bash
curl -i -c cookies.txt \
  -X POST http://localhost:8099/api/session \
  -H "Content-Type: application/json" \
  -d '{"username":"customer1","password":"Customer@123"}'
```

Successful response: `201 Created`

```json
{
  "data": {
    "username": "customer1",
    "role": "customer",
    "profile": {
      "id": "CUSTOMER_OBJECT_ID",
      "name": "Bob Johnson",
      "branchNo": null
    }
  }
}
```

### Current session

`GET /api/session`

```bash
curl -b cookies.txt http://localhost:8099/api/session
```

### Sign out

`DELETE /api/session`

```bash
curl -i -b cookies.txt -X DELETE http://localhost:8099/api/session
```

Successful response: `204 No Content`

All endpoints below require a signed-in session.

## Error format

```json
{
  "error": "Human-readable explanation"
}
```

Common statuses:

- `400`: invalid input
- `401`: no valid session
- `403`: role or record ownership violation
- `404`: missing record or record outside the user's scope
- `405`: operation intentionally disabled
- `409`: capacity, duplicate, or data-integrity conflict

## Branches

`GET /api/branches`

Returns branches whose `operatingStatus` is `active` or `resting`, with their configured reservation slots. `disabled` branches are omitted. Available to every signed-in role.

```json
{
  "data": [
    {
      "branchNo": 1,
      "name": "Downtown Room",
      "operatingStatus": "active",
      "bookingSlots": [
        {
          "startTime": "19:00",
          "endTime": "21:00",
          "capacity": 28
        }
      ]
    },
    {
      "branchNo": 2,
      "name": "Waterfront Kitchen",
      "operatingStatus": "resting",
      "bookingSlots": [
        {
          "startTime": "18:00",
          "endTime": "20:00",
          "capacity": 30
        }
      ]
    }
  ]
}
```

Branch states:

- `active`: accepts customer reservations and orders.
- `resting`: remains visible to signed-in clients and staff can still access its workspace, but `POST /api/bookings` and `POST /api/orders` reject it.
- `disabled`: omitted from this endpoint and unavailable to customers.

Branch operating status is managed by the administrator web interface. This API exposes branches as a read-only resource.

## Meals

### List meals

`GET /api/meals`

Customers and staff receive available meals. Administrators receive all meals.

### Read one meal

`GET /api/meals/:id`

### Create a meal

`POST /api/meals` · admin only

```bash
curl -b admin-cookies.txt \
  -X POST http://localhost:8099/api/meals \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lemon Ricotta Cake",
    "category": "Dessert",
    "description": "Citrus cake with whipped ricotta.",
    "price": 8.25,
    "isAvailable": true
  }'
```

### Update a meal

`PATCH /api/meals/:id` · admin only

```bash
curl -b admin-cookies.txt \
  -X PATCH http://localhost:8099/api/meals/MEAL_ID \
  -H "Content-Type: application/json" \
  -d '{"price":8.75,"isAvailable":false}'
```

### Delete a meal

`DELETE /api/meals/:id` · admin only

Physical deletion succeeds only when the meal is absent from every order. Meals with order history return `409`; disable them with `PATCH` instead.

## Bookings

Booking statuses: `pending`, `confirmed`, `cancelled`, `completed`.

### List bookings

`GET /api/bookings`

- Customer: own bookings
- Staff: bookings at their branch
- Admin: all bookings

Optional filters: `?status=pending&branchNo=1`

### Read a booking

`GET /api/bookings/:id`

### Create a booking

`POST /api/bookings` · customer only

```bash
curl -b cookies.txt \
  -X POST http://localhost:8099/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "branchNo": 1,
    "bookingDate": "2026-12-10",
    "slotStart": "19:00",
    "slotEnd": "21:00",
    "partySize": 4,
    "notes": "Window table if available"
  }'
```

The server validates:

- date is today or future
- branch `operatingStatus` is `active`
- date is not the branch rest day
- slot exists in the branch configuration
- today's slot has not passed
- party size is between 1 and 12
- capacity remains for the party
- the customer has no duplicate active booking at the same branch/date/slot

### Update a booking

`PATCH /api/bookings/:id`

Customer: resend date, branch, slot, party size, and notes to update an active booking.

```bash
curl -b cookies.txt \
  -X PATCH http://localhost:8099/api/bookings/BOOKING_ID \
  -H "Content-Type: application/json" \
  -d '{
    "branchNo": 1,
    "bookingDate": "2026-12-10",
    "slotStart": "19:00",
    "slotEnd": "21:00",
    "partySize": 3,
    "notes": "Party of three now"
  }'
```

Customer cancellation:

```bash
curl -b cookies.txt \
  -X PATCH http://localhost:8099/api/bookings/BOOKING_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"cancelled"}'
```

Staff and admin status update:

```bash
curl -b staff-cookies.txt \
  -X PATCH http://localhost:8099/api/bookings/BOOKING_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"confirmed"}'
```

### Delete a booking

`DELETE /api/bookings/:id` is intentionally disabled and returns `405`. Use cancellation to preserve history.

## Orders

Order statuses: `placed`, `preparing`, `ready`, `completed`, `cancelled`.

### List orders

`GET /api/orders`

- Customer: own orders
- Staff: their branch orders
- Admin: all orders

Optional filters: `?status=placed&branchNo=1`

### Read an order

`GET /api/orders/:id`

### Create an order

`POST /api/orders` · customer only

```bash
curl -b cookies.txt \
  -X POST http://localhost:8099/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "branchNo": 1,
    "items": [
      {"mealId": "MEAL_OBJECT_ID", "quantity": 2}
    ]
  }'
```

The client cannot submit a total or unit price. The server loads each available meal, creates name/price snapshots, and calculates the stored total.

Orders can only be placed against a branch whose `operatingStatus` is `active`.

### Update kitchen status

`PATCH /api/orders/:id` · staff or admin only

```bash
curl -b staff-cookies.txt \
  -X PATCH http://localhost:8099/api/orders/ORDER_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"preparing"}'
```

Staff can only update orders at their assigned branch.

### Delete an order

`DELETE /api/orders/:id` is intentionally disabled and returns `405`. Use cancellation to preserve history.
