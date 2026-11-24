param(
  [string]$BaseUrl = "http://localhost:8099"
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")
$script:Passed = 0
$script:Failed = 0

function New-ApiSession {
  return New-Object Microsoft.PowerShell.Commands.WebRequestSession
}

function Invoke-Api {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [object]$Body
  )

  $request = @{
    Method = $Method
    Uri = "$BaseUrl$Path"
    UseBasicParsing = $true
    ErrorAction = "Stop"
  }

  if ($null -ne $Session) {
    $request.WebSession = $Session
  }

  if ($null -ne $Body) {
    $request.ContentType = "application/json"
    $request.Body = $Body | ConvertTo-Json -Depth 10 -Compress
  }

  try {
    $response = Invoke-WebRequest @request
    $data = $null
    if (-not [string]::IsNullOrWhiteSpace($response.Content)) {
      $data = $response.Content | ConvertFrom-Json
    }
    return [pscustomobject]@{
      Status = [int]$response.StatusCode
      Data = $data
    }
  }
  catch {
    $status = 0
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $status = [int]$_.Exception.Response.StatusCode
    }
    return [pscustomobject]@{
      Status = $status
      Data = $null
    }
  }
}

function Test-Result {
  param(
    [string]$Name,
    [object]$Actual,
    [object]$Expected
  )

  if ($Actual -eq $Expected) {
    $script:Passed += 1
    Write-Host ("PASS  {0,-34} {1}" -f $Name, $Actual) -ForegroundColor Green
  }
  else {
    $script:Failed += 1
    Write-Host (
      "FAIL  {0,-34} expected={1} actual={2}" -f $Name, $Expected, $Actual
    ) -ForegroundColor Red
  }
}

Write-Host "Saffron & Stone REST API speed test" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host ""

$anonymous = Invoke-Api -Method GET -Path "/api/branches"
Test-Result "Anonymous branches" $anonymous.Status 401

$customer = New-ApiSession
$customerLogin = Invoke-Api -Method POST -Path "/api/session" `
  -Session $customer `
  -Body @{ username = "customer1"; password = "Customer@123" }
Test-Result "Customer login" $customerLogin.Status 201
Test-Result "Customer role" $customerLogin.Data.data.role "customer"

$session = Invoke-Api -Method GET -Path "/api/session" -Session $customer
Test-Result "Current customer session" $session.Status 200
Test-Result "Customer name" $session.Data.data.profile.name "Bob Johnson"

$branches = (Invoke-Api -Method GET -Path "/api/branches" -Session $customer).Data.data
$branch1 = $branches | Where-Object { $_.branchNo -eq 1 } | Select-Object -First 1
$branch2 = $branches | Where-Object { $_.branchNo -eq 2 } | Select-Object -First 1
Test-Result "Branch 1 operating status" $branch1.operatingStatus "active"
Test-Result "Branch 2 operating status" $branch2.operatingStatus "resting"

$meals = (Invoke-Api -Method GET -Path "/api/meals" -Session $customer).Data.data
Test-Result "Meal catalog available" ($meals.Count -gt 0) $true
$mealId = $meals[0]._id

$bookingDate = (Get-Date).Date.AddDays(7)
while ($bookingDate.DayOfWeek -eq "Monday") {
  $bookingDate = $bookingDate.AddDays(1)
}

$bookingBody = @{
  branchNo = 1
  bookingDate = $bookingDate.ToString("yyyy-MM-dd")
  slotStart = "19:00"
  slotEnd = "21:00"
  partySize = 2
  notes = "Speed test"
}

$bookingResponse = Invoke-Api -Method POST -Path "/api/bookings" `
  -Session $customer -Body $bookingBody
Test-Result "Create Branch 1 booking" $bookingResponse.Status 201
Test-Result "New booking status" $bookingResponse.Data.data.status "pending"
$bookingId = $bookingResponse.Data.data._id

$duplicateBooking = Invoke-Api -Method POST -Path "/api/bookings" `
  -Session $customer -Body $bookingBody
Test-Result "Reject duplicate booking" $duplicateBooking.Status 409

$restingBooking = Invoke-Api -Method POST -Path "/api/bookings" `
  -Session $customer `
  -Body @{
    branchNo = 2
    bookingDate = (Get-Date).Date.AddDays(10).ToString("yyyy-MM-dd")
    slotStart = "10:00"
    slotEnd = "12:00"
    partySize = 2
  }
Test-Result "Reject resting-branch booking" $restingBooking.Status 404

$orderBody = @{
  branchNo = 1
  items = @(
    @{
      mealId = $mealId
      quantity = 2
    }
  )
}

$orderResponse = Invoke-Api -Method POST -Path "/api/orders" `
  -Session $customer -Body $orderBody
Test-Result "Create Branch 1 order" $orderResponse.Status 201
Test-Result "New order status" $orderResponse.Data.data.status "placed"
Test-Result "Server-calculated order total" `
  ($orderResponse.Data.data.totalAmount -gt 0) $true
$orderId = $orderResponse.Data.data._id

$restingOrder = Invoke-Api -Method POST -Path "/api/orders" `
  -Session $customer `
  -Body @{
    branchNo = 2
    items = @(
      @{
        mealId = $mealId
        quantity = 1
      }
    )
  }
Test-Result "Reject resting-branch order" $restingOrder.Status 400

$staff = New-ApiSession
$staffLogin = Invoke-Api -Method POST -Path "/api/session" `
  -Session $staff `
  -Body @{ username = "staff1"; password = "Staff@123" }
Test-Result "Staff 1 login" $staffLogin.Status 201

$orderUpdate = Invoke-Api -Method PATCH -Path "/api/orders/$orderId" `
  -Session $staff -Body @{ status = "preparing" }
Test-Result "Staff updates order" $orderUpdate.Status 200
Test-Result "Updated order status" $orderUpdate.Data.data.status "preparing"

$staffIsolation = Invoke-Api -Method GET -Path "/api/orders?branchNo=2" `
  -Session $staff
Test-Result "Staff branch isolation" $staffIsolation.Status 403

$staff2 = New-ApiSession
$staff2Login = Invoke-Api -Method POST -Path "/api/session" `
  -Session $staff2 `
  -Body @{ username = "staff2"; password = "Staff2@123" }
Test-Result "Staff 2 login" $staff2Login.Status 201

$staff2Orders = (Invoke-Api -Method GET -Path "/api/orders" -Session $staff2).Data.data
$staff2Bookings = (Invoke-Api -Method GET -Path "/api/bookings" -Session $staff2).Data.data
Test-Result "Staff 2 order count" $staff2Orders.Count 0
Test-Result "Staff 2 booking count" $staff2Bookings.Count 0

$bookingDelete = Invoke-Api -Method DELETE `
  -Path "/api/bookings/$bookingId" -Session $customer
$orderDelete = Invoke-Api -Method DELETE `
  -Path "/api/orders/$orderId" -Session $staff
Test-Result "Booking DELETE is disabled" $bookingDelete.Status 405
Test-Result "Order DELETE is disabled" $orderDelete.Status 405

$admin = New-ApiSession
$adminLogin = Invoke-Api -Method POST -Path "/api/session" `
  -Session $admin `
  -Body @{ username = "admin1"; password = "Admin@123" }
Test-Result "Admin login" $adminLogin.Status 201

$mealCreate = Invoke-Api -Method POST -Path "/api/meals" `
  -Session $admin `
  -Body @{
    name = "Speed Test Meal"
    category = "Test"
    description = "Temporary API test"
    price = 1.50
    isAvailable = $true
  }
Test-Result "Admin creates meal" $mealCreate.Status 201
$temporaryMealId = $mealCreate.Data.data._id

$mealUpdate = Invoke-Api -Method PATCH `
  -Path "/api/meals/$temporaryMealId" `
  -Session $admin `
  -Body @{ price = 2.25; isAvailable = $false }
Test-Result "Admin updates meal" $mealUpdate.Status 200
Test-Result "Updated meal price" $mealUpdate.Data.data.price 2.25

$mealDelete = Invoke-Api -Method DELETE `
  -Path "/api/meals/$temporaryMealId" -Session $admin
Test-Result "Admin deletes unused meal" $mealDelete.Status 204

$logout = Invoke-Api -Method DELETE -Path "/api/session" -Session $customer
Test-Result "Customer logout" $logout.Status 204

Write-Host ""
Write-Host (
  "Result: {0} passed, {1} failed" -f $script:Passed, $script:Failed
) -ForegroundColor Cyan
Write-Host "Run 'npm run reset' to remove the test booking and order."

if ($script:Failed -gt 0) {
  exit 1
}
