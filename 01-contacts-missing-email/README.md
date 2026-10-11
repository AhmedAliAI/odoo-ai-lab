# 01 · Contacts missing email

A data-quality check that lists Odoo contacts with no email address.

**Flow:** Manual trigger → Odoo `res.partner` search (domain `email = false`, limit 500) → Filter (also catches blank strings) → Set (name, phone, city)

**Why the filter runs inside Odoo:** pulling every contact and then filtering in n8n hit "Maximum call stack size exceeded" on a large database. Pushing the domain to Odoo fixed it, and it is the right pattern anyway.
