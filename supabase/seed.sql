-- ==============================================================================
-- THREDO Comprehensive Seed Data for Supabase
-- Populates complete, realistic demo records for tailoring operations, POS,
-- accounting, customers, inventory, and workshop management.
-- ==============================================================================

-- 1. Default Business Tenancy
insert into public.businesses (id, name, slug, contact_name, email, phone, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'THREDO Fashion Studio',
  'thredo-dubai',
  'General Manager',
  'contact@octapus.ae',
  '+971 52 872 4090',
  'active'
) on conflict (id) do update set name = excluded.name;

-- 2. Default Company Profile
insert into public.companies (
  id, business_id, name, legal_name, registration_number, tax_number, address, phone, email, whatsapp, currency, timezone
) values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'THREDO Tailoring & POS',
  'THREDO Garments & Tailoring LLC',
  'DXB-984210',
  '100234857200003',
  'Al Wasl Road, Al Satwa, Dubai, United Arab Emirates',
  '+971 52 872 4090',
  'contact@octapus.ae',
  '+971 52 872 4090',
  'AED',
  'Asia/Dubai'
) on conflict (id) do nothing;

-- 3. Subscription Plans
insert into public.subscription_plans (id, name, price_label, amount, duration_days, payment_url, is_active, sort_order)
values
  ('00000000-0000-0000-0000-000000000011', 'Yearly Pro', 'AED 2,222/yr', 2222.00, 365, 'https://pay.ziina.com/mehar/yearly', true, 1),
  ('00000000-0000-0000-0000-000000000012', 'Lifetime Perpetual', 'AED 3,200 one-time', 3200.00, 36500, 'https://pay.ziina.com/mehar/lifetime', true, 2)
on conflict (id) do nothing;

-- 4. Measurement Templates
insert into public.measurement_templates (name, category, fields, is_active, business_id)
values
  ('Emirati Kandora', 'Men', '[{"field_name":"Length","name":"Length","unit":"in","default_unit":"in","default_value":"58.5","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Shoulder","name":"Shoulder","unit":"in","default_unit":"in","default_value":"18.5","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Sleeves","name":"Sleeves","unit":"in","default_unit":"in","default_value":"25.0","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Neck / Collar","name":"Neck / Collar","unit":"in","default_unit":"in","default_value":"16.5","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Chest","name":"Chest","unit":"in","default_unit":"in","default_value":"42.0","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Waist","name":"Waist","unit":"in","default_unit":"in","default_value":"38.0","required":false,"is_required":false,"show_in_quick_view":false},{"field_name":"Bottom Flare","name":"Bottom Flare","unit":"in","default_unit":"in","default_value":"31.0","required":false,"is_required":false,"show_in_quick_view":false}]'::jsonb, true, '00000000-0000-0000-0000-000000000001'),
  ('Bespoke 2-Piece Suit', 'Men', '[{"field_name":"Jacket Length","name":"Jacket Length","unit":"in","default_unit":"in","default_value":"30.5","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Chest","name":"Chest","unit":"in","default_unit":"in","default_value":"41.0","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Waist","name":"Waist","unit":"in","default_unit":"in","default_value":"33.5","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Shoulder Width","name":"Shoulder Width","unit":"in","default_unit":"in","default_value":"18.5","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Sleeve Length","name":"Sleeve Length","unit":"in","default_unit":"in","default_value":"25.0","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Trouser Length","name":"Trouser Length","unit":"in","default_unit":"in","default_value":"42.0","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Inseam","name":"Inseam","unit":"in","default_unit":"in","default_value":"32.0","required":true,"is_required":true,"show_in_quick_view":true}]'::jsonb, true, '00000000-0000-0000-0000-000000000001'),
  ('Formal Shirt', 'Men', '[{"field_name":"Collar","name":"Collar","unit":"in","default_unit":"in","default_value":"16.0","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Chest","name":"Chest","unit":"in","default_unit":"in","default_value":"40.5","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Waist","name":"Waist","unit":"in","default_unit":"in","default_value":"34.0","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Shirt Length","name":"Shirt Length","unit":"in","default_unit":"in","default_value":"31.0","required":true,"is_required":true,"show_in_quick_view":true},{"field_name":"Sleeve","name":"Sleeve","unit":"in","default_unit":"in","default_value":"25.5","required":true,"is_required":true,"show_in_quick_view":true}]'::jsonb, true, '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- 5. Workshop Craftsmen & Tailors
insert into public.tailors (name, department, phone, email, specialization, rate_type, rate, completed_orders, active, business_id)
values
  ('Master Rashid', 'Workshop A — Kandoras', '+971 50 123 4567', 'rashid@thredo.ae', 'Emirati Kandora Specialist', 'piecework', 45, 86, true, '00000000-0000-0000-0000-000000000001'),
  ('Tariq Mahmood', 'Workshop B — Bespoke Suits', '+971 55 889 1234', 'tariq@thredo.ae', 'Bespoke Suit & Tuxedo Cutter', 'piecework', 180, 52, true, '00000000-0000-0000-0000-000000000001'),
  ('Nadeem Tailor', 'Workshop B — Jackets', '+971 55 987 6543', 'nadeem@thredo.ae', 'Jacket & Coat Craftsman', 'piecework', 150, 48, true, '00000000-0000-0000-0000-000000000001'),
  ('Farooq Alterations', 'Alterations & Fitting', '+971 52 456 7890', 'farooq@thredo.ae', 'Fitting & Alterations', 'hourly', 35, 120, true, '00000000-0000-0000-0000-000000000001'),
  ('Karim Master', 'Workshop C — Traditional & Luxury', '+971 50 998 7766', 'karim@thredo.ae', 'Sherwani, Bisht & Gold Embroidery', 'piecework', 220, 34, true, '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- 6. VIP & Regular Customers
insert into public.customers (name, phone, email, whatsapp, city, area, address, status, total_orders, total_spent, outstanding_balance, notes, business_id)
values
  ('Sultan Al Marzouqi', '+971 50 123 4567', 'sultan@almarzouqi.ae', '+971 50 123 4567', 'Dubai', 'Jumeirah 2', 'Villa 14, Street 18B, Jumeirah 2', 'active', 12, 18900, 0, 'Prefers Japanese Toyobo cotton with double-stitched collar. Very punctual delivery requested.', '00000000-0000-0000-0000-000000000001'),
  ('Alex Hunter', '+971 52 987 6543', 'alex.hunter@example.com', '+971 52 987 6543', 'Dubai', 'Dubai Marina', 'Marina Gate Tower 1, Apt 2402', 'active', 5, 6800, 610, 'Slim fit bespoke suits. Enjoys contrasting silk inner linings.', '00000000-0000-0000-0000-000000000001'),
  ('Mohammed Al Mansoori', '+971 55 234 5678', 'mohammed@mansoori.ae', '+971 55 234 5678', 'Abu Dhabi', 'Al Bateen', 'Palace View Compound, Villa 6', 'active', 6, 9200, 380, 'Traditional Emirati style with soft tassels (tarboosh).', '00000000-0000-0000-0000-000000000001'),
  ('Dr. David Miller', '+971 54 321 0987', 'dr.miller@clevelandclinic.ae', '+971 54 321 0987', 'Dubai', 'Emirates Hills', 'Sector E, Villa 22', 'active', 4, 7650, 0, 'Medical director. French cuffs on formal shirts with monogram ''D.M.''', '00000000-0000-0000-0000-000000000001'),
  ('Sheikh Rashid Al Nuaimi', '+971 50 882 1928', 'rashid@alnuaimi.ae', '+971 50 882 1928', 'Ajman', 'Al Rumailah', 'Corniche Road Residence', 'active', 9, 14500, 360, 'Prefers Super 150s fabrics for evening Kandoras. High collar with mother of pearl buttons.', '00000000-0000-0000-0000-000000000001'),
  ('Hamdan Al Falasi', '+971 55 678 1234', 'hamdan@alfalasi.ae', '+971 55 678 1234', 'Dubai', 'Al Barsha', 'Al Barsha South, Street 22', 'active', 11, 22300, 0, 'VIP Client. Frequent orders for wedding and festive occasions.', '00000000-0000-0000-0000-000000000001'),
  ('Tariq Al Suwaidi', '+971 50 445 6789', 'tariq@alsuwaidi.ae', '+971 50 445 6789', 'Dubai', 'Nad Al Sheba', 'Nad Al Sheba 1, Villa 45', 'active', 8, 12450, 950, 'Tuxedos and dinner jackets. Peak lapel preference.', '00000000-0000-0000-0000-000000000001'),
  ('Ahmed Bin Saeed', '+971 52 345 6789', 'ahmed@binsaeed.ae', '+971 52 345 6789', 'Dubai', 'Downtown Dubai', 'The Address Residences, Apt 3104', 'active', 7, 11200, 0, 'Modern cuts, linen blazers and safari jackets.', '00000000-0000-0000-0000-000000000001'),
  ('Omar Farooq', '+971 50 765 4321', 'omar.farooq@investments.ae', '+971 50 765 4321', 'Dubai', 'Business Bay', 'Executive Towers, Tower B', 'active', 4, 5100, 725, 'Business wardrobe client.', '00000000-0000-0000-0000-000000000001'),
  ('Fatima Al Zahra', '+971 56 789 0123', 'fatima@alzahra.ae', '+971 56 789 0123', 'Sharjah', 'Al Majaz', 'Corniche Tower, Apt 1102', 'active', 3, 3400, 0, 'Ordering custom embroidered traditional items for family.', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- 7. Fabrics Catalog & Tailoring Services
insert into public.products (name, sku, category, price, cost, stock_quantity, unit, active, business_id)
values
  ('Japanese Crepe Kandora Fabric (White)', 'FAB-JP01', 'Fabrics', 180, 95, 65, 'meters', true, '00000000-0000-0000-0000-000000000001'),
  ('Japanese Toyobo Royal Cotton (Off-White)', 'FAB-TYB02', 'Fabrics', 220, 115, 80, 'meters', true, '00000000-0000-0000-0000-000000000001'),
  ('Italian Super 150s Wool (Navy Blue)', 'FAB-IT150', 'Fabrics', 420, 210, 35, 'meters', true, '00000000-0000-0000-0000-000000000001'),
  ('Italian Super 130s Glen Plaid Wool', 'FAB-IT130', 'Fabrics', 380, 190, 28, 'meters', true, '00000000-0000-0000-0000-000000000001'),
  ('Pure Egyptian Giza 90 Cotton (Sky Blue)', 'FAB-EG90', 'Fabrics', 210, 105, 50, 'meters', true, '00000000-0000-0000-0000-000000000001'),
  ('Irish Natural Linen (Sand Beige)', 'FAB-IR100', 'Fabrics', 190, 95, 40, 'meters', true, '00000000-0000-0000-0000-000000000001'),
  ('Bespoke 2-Piece Suit Tailoring', 'TL-SUIT2P', 'Tailoring', 850, 280, 999, 'piece', true, '00000000-0000-0000-0000-000000000001'),
  ('Traditional Emirati Kandora Stitching', 'TL-KAND', 'Tailoring', 220, 65, 999, 'piece', true, '00000000-0000-0000-0000-000000000001'),
  ('Bespoke Tuxedo Tailoring', 'TL-TUX', 'Tailoring', 1200, 350, 999, 'piece', true, '00000000-0000-0000-0000-000000000001'),
  ('Custom Fitted Formal Shirt', 'TL-SHIRT', 'Tailoring', 160, 45, 999, 'piece', true, '00000000-0000-0000-0000-000000000001'),
  ('Pure Silk Tie — Midnight Navy', 'ACC-TIE01', 'Accessories', 110, 40, 24, 'piece', true, '00000000-0000-0000-0000-000000000001'),
  ('Mother of Pearl Cufflinks Set', 'ACC-CUFF01', 'Accessories', 150, 55, 18, 'set', true, '00000000-0000-0000-0000-000000000001'),
  ('24k Gold-Plated Metallic Agal & Headwear Set', 'ACC-AGAL01', 'Accessories', 250, 90, 12, 'set', true, '00000000-0000-0000-0000-000000000001'),
  ('Custom Monogram Silk Lining', 'ACC-LINE01', 'Accessories', 85, 30, 45, 'meters', true, '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- 8. Tailoring Orders
insert into public.orders (order_id, customer_name, booking_date, delivery_date, priority, order_type, status, template_name, fabric_type, fabric_quantity, fabric_cost, tailor_name, tailor_rate, subtotal, total_amount, amount_paid, balance_due, payment_status, payment_method, delivery_method, remarks, customer_id, business_id)
select o.order_id, o.customer_name, o.booking_date, o.delivery_date, o.priority, o.order_type, o.status, o.template_name, o.fabric_type, o.fabric_quantity, o.fabric_cost, o.tailor_name, o.tailor_rate, o.subtotal, o.total_amount, o.amount_paid, o.balance_due, o.payment_status, o.payment_method, o.delivery_method, o.remarks, c.id, '00000000-0000-0000-0000-000000000001'
from (values
  ('ORD-2026-101', 'Sultan Al Marzouqi', '2026-10-10'::date, '2026-10-22'::date, 'Normal', 'Standard', 'Ready', 'Emirati Kandora', 'Japanese Toyobo Royal Cotton', 4, 220, 'Master Rashid', 45, 1260, 1323, 1323, 0, 'Paid', 'Card', 'Pickup', 'Quality checked and pressed. Awaiting customer pickup.'),
  ('ORD-2026-102', 'Alex Hunter', '2026-10-12'::date, '2026-10-25'::date, 'Rush', 'Standard', 'Trial', 'Bespoke 2-Piece Suit', 'Italian Super 150s Wool (Navy Blue)', 3.5, 420, 'Tariq Mahmood', 180, 2320, 2436, 1500, 936, 'Partial', 'Card', 'Pickup', 'Basted fitting trial scheduled for Thursday afternoon.'),
  ('ORD-2026-103', 'Sheikh Rashid Al Nuaimi', '2026-10-14'::date, '2026-10-24'::date, 'Premium', 'Standard', 'Stitching', 'Emirati Kandora', 'Japanese Crepe Kandora Fabric', 4, 180, 'Master Rashid', 45, 940, 987, 500, 487, 'Partial', 'Cash', 'Delivery', 'Sleeve embroidery in progress.'),
  ('ORD-2026-104', 'Dr. David Miller', '2026-10-15'::date, '2026-10-26'::date, 'Normal', 'Standard', 'Cutting', 'Formal Shirt', 'Pure Egyptian Giza 90 Cotton', 3, 210, 'Nadeem Tailor', 55, 790, 829.5, 829.5, 0, 'Paid', 'Card', 'Pickup', 'Fabric cut and prepared for assembly.'),
  ('ORD-2026-105', 'Tariq Al Suwaidi', '2026-10-16'::date, '2026-10-28'::date, 'Premium', 'Standard', 'Quality Check', 'Bespoke 2-Piece Suit', 'Italian Super 130s Glen Plaid Wool', 3.5, 380, 'Tariq Mahmood', 180, 2530, 2656.5, 2000, 656.5, 'Partial', 'Bank Transfer', 'Pickup', 'Final pressing and button alignment check.'),
  ('ORD-2026-106', 'Hamdan Al Falasi', '2026-10-05'::date, '2026-10-15'::date, 'Premium', 'Standard', 'Delivered', 'Emirati Kandora', 'Japanese Toyobo Royal Cotton', 8, 220, 'Karim Master', 65, 2640, 2772, 2772, 0, 'Paid', 'Bank Transfer', 'Delivery', 'VIP delivery completed to Al Barsha residence.'),
  ('ORD-2026-107', 'Omar Farooq', '2026-10-18'::date, '2026-10-30'::date, 'Normal', 'Standard', 'Booked', 'Bespoke 2-Piece Suit', 'Irish Natural Linen', 3.5, 190, 'Nadeem Tailor', 150, 1515, 1590.75, 800, 790.75, 'Partial', 'Card', 'Pickup', 'Fabric allocated. Pattern draft pending tailor review.')
) as o(order_id, customer_name, booking_date, delivery_date, priority, order_type, status, template_name, fabric_type, fabric_quantity, fabric_cost, tailor_name, tailor_rate, subtotal, total_amount, amount_paid, balance_due, payment_status, payment_method, delivery_method, remarks)
join public.customers c on c.name = o.customer_name and c.business_id = '00000000-0000-0000-0000-000000000001'
on conflict (order_id) do nothing;

-- 9. POS Sales & Tax Invoices
insert into public.sales (sale_id, customer_name, customer_phone, customer_email, items, subtotal, discount, tax_percent, tax_amount, total, amount_paid, balance_due, payment_method, payment_status, date, status, bill_sent_whatsapp, whatsapp_status, sent_to_number, whatsapp_history, business_id)
values
  ('INV-2026-1001', 'Sultan Al Marzouqi', '+971 50 123 4567', 'sultan@almarzouqi.ae', '[{"product_id":"prod-2","name":"Japanese Toyobo Royal Cotton","price":220,"quantity":4,"line_total":880},{"product_id":"prod-8","name":"Traditional Emirati Kandora Stitching","price":220,"quantity":1,"line_total":220}]'::jsonb, 1100, 50, 5, 52.5, 1102.5, 1102.5, 0, 'Card', 'Paid', '2026-10-12'::date, 'Completed', true, 'Delivered', '971501234567', '[{"timestamp":"2026-10-12T16:20:00Z","recipient":"971501234567","status":"Delivered","message_id":"msg_orb_984210"}]'::jsonb, '00000000-0000-0000-0000-000000000001'),
  ('INV-2026-1002', 'Alex Hunter', '+971 52 987 6543', 'alex.hunter@example.com', '[{"product_id":"prod-11","name":"Pure Silk Tie — Midnight Navy","price":110,"quantity":2,"line_total":220},{"product_id":"prod-12","name":"Mother of Pearl Cufflinks Set","price":150,"quantity":1,"line_total":150}]'::jsonb, 370, 0, 5, 18.5, 388.5, 388.5, 0, 'Cash', 'Paid', '2026-10-13'::date, 'Completed', true, 'Delivered', '971529876543', '[{"timestamp":"2026-10-13T12:10:00Z","recipient":"971529876543","status":"Delivered","message_id":"msg_orb_984211"}]'::jsonb, '00000000-0000-0000-0000-000000000001'),
  ('INV-2026-1003', 'Hamdan Al Falasi', '+971 55 678 1234', 'hamdan@alfalasi.ae', '[{"product_id":"prod-2","name":"Japanese Toyobo Royal Cotton","price":220,"quantity":8,"line_total":1760},{"product_id":"prod-8","name":"Traditional Emirati Kandora Stitching","price":220,"quantity":4,"line_total":880},{"product_id":"prod-13","name":"24k Gold-Plated Metallic Agal Set","price":250,"quantity":1,"line_total":250}]'::jsonb, 2890, 100, 5, 139.5, 2929.5, 2929.5, 0, 'Bank Transfer', 'Paid', '2026-10-15'::date, 'Completed', true, 'Delivered', '971556781234', '[{"timestamp":"2026-10-15T14:05:00Z","recipient":"971556781234","status":"Delivered","message_id":"msg_orb_984212"}]'::jsonb, '00000000-0000-0000-0000-000000000001'),
  ('INV-2026-1004', 'Dr. David Miller', '+971 54 321 0987', 'dr.miller@clevelandclinic.ae', '[{"product_id":"prod-5","name":"Pure Egyptian Giza 90 Cotton","price":210,"quantity":3,"line_total":630},{"product_id":"prod-10","name":"Custom Fitted Formal Shirt","price":160,"quantity":3,"line_total":480}]'::jsonb, 1110, 60, 5, 52.5, 1102.5, 1102.5, 0, 'Card', 'Paid', '2026-10-17'::date, 'Completed', true, 'Submitted', '971543210987', '[{"timestamp":"2026-10-17T11:45:00Z","recipient":"971543210987","status":"Submitted","message_id":"msg_orb_984213"}]'::jsonb, '00000000-0000-0000-0000-000000000001')
on conflict (sale_id) do nothing;

-- 10. Payment Receipts
insert into public.payments (order_ref, customer_name, amount, payment_method, date, reference_number, notes, type, business_id)
values
  ('ORD-2026-101', 'Sultan Al Marzouqi', 1323, 'Card', '2026-10-10'::date, 'TXN-CRD-9812', 'Full payment collected at order booking.', 'payment', '00000000-0000-0000-0000-000000000001'),
  ('ORD-2026-102', 'Alex Hunter', 1500, 'Card', '2026-10-12'::date, 'TXN-CRD-9844', 'Advance deposit for bespoke 2-piece wool suit.', 'advance', '00000000-0000-0000-0000-000000000001'),
  ('ORD-2026-103', 'Sheikh Rashid Al Nuaimi', 500, 'Cash', '2026-10-14'::date, 'REC-CSH-0103', 'Cash advance received in showroom register.', 'advance', '00000000-0000-0000-0000-000000000001'),
  ('ORD-2026-104', 'Dr. David Miller', 829.5, 'Card', '2026-10-15'::date, 'TXN-CRD-9901', 'Payment in full for 3 bespoke formal shirts.', 'payment', '00000000-0000-0000-0000-000000000001'),
  ('ORD-2026-105', 'Tariq Al Suwaidi', 2000, 'Bank Transfer', '2026-10-16'::date, 'ENBD-BT-77412', 'Wire transfer confirmed via Emirates NBD.', 'advance', '00000000-0000-0000-0000-000000000001'),
  ('ORD-2026-106', 'Hamdan Al Falasi', 2772, 'Bank Transfer', '2026-10-05'::date, 'DIB-TRF-55821', 'Dubai Islamic Bank transfer for 4x VIP thobes.', 'payment', '00000000-0000-0000-0000-000000000001'),
  ('ORD-2026-107', 'Omar Farooq', 800, 'Card', '2026-10-18'::date, 'TXN-CRD-9964', '50% advance on bespoke linen blazer and trouser set.', 'advance', '00000000-0000-0000-0000-000000000001');

-- 11. Operational Expenses
insert into public.expenses (date, category, description, amount, payment_method, reference_number, business_id)
values
  ('2026-10-02'::date, 'Fabric Purchase', 'Direct import: 5 rolls Japanese Toyobo Cotton & Crepe fabrics', 4850, 'Bank Transfer', 'IMP-TYB-2026', '00000000-0000-0000-0000-000000000001'),
  ('2026-10-04'::date, 'Thread & Accessories', 'High-tensile silk embroidery threads, mother of pearl buttons & agal cords', 1420, 'Card', 'ACC-DUB-110', '00000000-0000-0000-0000-000000000001'),
  ('2026-10-08'::date, 'Equipment', 'Annual maintenance & calibration of 4 Juki industrial lockstitch machines', 850, 'Cash', 'JUKI-SVC-402', '00000000-0000-0000-0000-000000000001'),
  ('2026-10-11'::date, 'Utilities', 'DEWA Showroom & Workshop electricity and AC cooling bill', 3200, 'Card', 'DEWA-102026', '00000000-0000-0000-0000-000000000001'),
  ('2026-10-14'::date, 'Marketing', 'Targeted digital campaign: Bespoke Kandora & Wedding Season tailored suits', 1500, 'Card', 'META-ADS-892', '00000000-0000-0000-0000-000000000001'),
  ('2026-10-16'::date, 'Transport', 'VIP doorstep fitting and delivery fleet fuel & Salik toll pass', 480, 'Cash', 'ENOC-FUEL-44', '00000000-0000-0000-0000-000000000001');

-- 12. Online Storefront Website Configuration
insert into public.website_configs (business_id, store_name, slug, online_ordering_enabled, contact_phone, delivery_charge)
values (
  '00000000-0000-0000-0000-000000000001',
  'THREDO Fashion Studio',
  'thredo',
  true,
  '+971 52 872 4090',
  25.00
) on conflict (business_id) do update set
  store_name = excluded.store_name,
  online_ordering_enabled = excluded.online_ordering_enabled;
