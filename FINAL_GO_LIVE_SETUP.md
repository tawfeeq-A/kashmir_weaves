# Kashmir Weaves — Final Go-Live Setup Guide

This guide explains how to set up the website, Supabase database, Google Sheet order logging, and final launch tests.

## Final workspace files

You only need these files:

- `index.html` — final website file to upload to your hosting
- `supabase-setup.sql` — Supabase database/tables/security setup
- `google-sheet-orders-script.gs` — Google Apps Script for order logging
- `FINAL_GO_LIVE_SETUP.md` — this guide

---

# Part 1 — Supabase setup

## 1. Create a Supabase project

1. Go to <https://supabase.com>.
2. Create a new project.
3. Wait until the project is fully created.

---

## 2. Create the database tables and security policies

1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Open the file `supabase-setup.sql` from this workspace.
4. Your admin email is already set to:

```text
tawfeeqahmadsofi13@gmail.com
```

5. Run the full SQL file.

This creates:

- `site_state` — stores website settings/products/categories/about images
- `orders` — stores order number, customer details, cart snapshot, total, payment info, and status

Security rules:

- Visitors can read public site data.
- Visitors can create orders.
- Visitors cannot read orders.
- Only your admin email can update website settings/products.
- Only your admin email can view/update orders.

---

## 3. Create the admin user

1. In Supabase, go to **Authentication → Users**.
2. Click **Add user**.
3. Use the same admin email you placed inside `supabase-setup.sql`.
4. Set a strong password.

You will use this email/password to log in to the hidden website admin panel.

---

## 4. Copy Supabase API values

In Supabase:

1. Go to **Project Settings → API**.
2. Copy your **Project URL**.
3. Copy your **anon public key**.

Do **not** copy the `service_role` key into HTML.

---

## 5. Supabase values already added to `index.html`

The Kashmir Weaves Supabase project URL and anon public key are already added inside:

```text
kashmir-weaves/netlify-deploy/index.html
```

Project URL:

```text
https://pbqmxmukeilutckhbicc.supabase.co
```

Do **not** add the `service_role` key to HTML.

---

# Part 2 — Google Sheet order logging

Supabase is the main database. Google Sheets is an additional live order log.

## 1. Create a Google Sheet

1. Go to <https://sheets.google.com>.
2. Create a blank spreadsheet.
3. You do not need to manually create columns. The script will create a tab named `Orders` and add headers automatically.

---

## 2. Add the Apps Script

1. In Google Sheets, go to **Extensions → Apps Script**.
2. Delete any existing code.
3. Paste the full contents of `google-sheet-orders-script.gs`.

Find this line:

```js
var SECRET_TOKEN = 'change-this-secret-token';
```

Replace it with your own private token:

```js
var SECRET_TOKEN = 'my-private-order-token-2026';
```

Use a token that is hard to guess.

---

## 3. Deploy the Google Apps Script

1. Click **Deploy → New deployment**.
2. Select type: **Web app**.
3. Set:

```text
Execute as: Me
Who has access: Anyone
```

4. Click **Deploy**.
5. Authorize the script if Google asks.
6. Copy the Web App URL.

It should look like:

```text
https://script.google.com/macros/s/AKfycb.../exec
```

---

# Part 3 — Upload the website

Upload only this file to your website hosting:

```text
index.html
```

You can host it on:

- GitHub Pages
- Netlify
- Vercel
- Hostinger/cPanel
- Any static hosting provider

Important: after adding Supabase values to `index.html`, upload that edited version.

---

# Part 4 — First admin setup on the live site

## 1. Open the live website

Visit your live website URL in a browser.

---

## 2. Open the hidden admin panel

Scroll to the footer and triple-click the copyright text:

```text
© 2026 Kashmir Weaves, Srinagar. All rights reserved.
```

The admin panel should open.

---

## 3. Log in

Use:

```text
Admin Email: tawfeeqahmadsofi13@gmail.com
Password: your Supabase admin password
```

---

## 4. Save the first website state to Supabase

1. Go to **Settings**.
2. Click **Save Settings** once.

This uploads the current products/settings/categories/about images to Supabase.

---

## 5. Connect Google Sheet inside Admin Settings

In **Admin Panel → Settings**, fill:

```text
Google Sheet Web App URL: your Apps Script Web App URL
Sheet Security Token: the same token you put in Apps Script
```

Click **Save Settings**.

---

# Part 5 — Final testing before launch

## Test 1 — Public website loading

Open your website in an incognito/private window.

Check:

- Products load correctly.
- Product filters work.
- About images load.
- Footer phone/location are correct.
- Mobile menu works.
- Cart opens/closes.

---

## Test 2 — Admin sync

In the admin panel:

1. Add a test product.
2. Save it.
3. Refresh the site on another browser/device.
4. Confirm the product appears.
5. Delete the test product.
6. Refresh again and confirm it disappears.

---

## Test 3 — WhatsApp order

1. Add a product to cart.
2. Click **Order via WhatsApp**.
3. Confirm the WhatsApp message has an order number.
4. In Supabase, check the `orders` table.
5. In Google Sheet, check the `Orders` tab.
6. In website admin, open **Orders** tab and confirm the order appears.

---

## Test 4 — Razorpay order

Use Razorpay test mode first.

1. Add product to cart.
2. Click **Pay Online (Razorpay)**.
3. Enter test customer details.
4. Complete test payment.
5. Confirm order appears in Supabase.
6. Confirm order appears in Google Sheet.
7. Confirm payment reference/Razorpay ID is saved.
8. Confirm status is `Paid`.

Before accepting real payments, manually compare test orders with Razorpay dashboard.

---

## Test 5 — Order status sync

1. Open **Admin Panel → Orders**.
2. Change an order status to `Packed` or `Shipped`.
3. Confirm Supabase updates.
4. Confirm Google Sheet status updates.

---

# Important launch notes

## Razorpay payment verification

The current site uses frontend Razorpay checkout. For a small launch, this is okay if you manually verify payments in Razorpay dashboard.

For a more secure production setup, add server-side Razorpay signature verification using:

- Supabase Edge Function
- Netlify Function
- Vercel API route
- Small Node.js backend

This is the most important future security improvement.

---

## Google Sheet token visibility

Because the website is static HTML, browser-side values can be inspected. The Sheet token helps reduce spam, but it is not a perfect secret.

For stronger security later, use:

```text
Website → Supabase Edge Function → Google Sheet
```

That keeps the Google Sheet token server-side.

---

## Product images

Use image URLs whenever possible instead of base64 uploads.

Recommended:

- Supabase Storage
- Cloudinary
- ImageKit
- ImgBB

This keeps the site faster and the database cleaner.

---

# Final upload checklist

Before announcing the site, confirm:

- [ ] Supabase URL and anon key added to `index.html`
- [ ] `supabase-setup.sql` ran successfully
- [ ] Supabase admin user created
- [ ] Google Apps Script deployed
- [ ] Google Sheet URL/token saved in Admin Settings
- [ ] Admin login works
- [ ] Product edit sync works
- [ ] WhatsApp order saves to Supabase + Sheet
- [ ] Razorpay test order saves to Supabase + Sheet
- [ ] Order status update syncs to Sheet
- [ ] Real phone/location/Razorpay key are correct
- [ ] Test products/orders removed before launch


## Supabase config status

The Kashmir Weaves Supabase project URL and anon public key have already been added to the live HTML file.

Project URL:

```text
https://pbqmxmukeilutckhbicc.supabase.co
```

Admin email:

```text
tawfeeqahmadsofi13@gmail.com
```
