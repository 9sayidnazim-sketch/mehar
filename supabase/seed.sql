-- ==============================================================================
-- THREDO Seed Data for Supabase
-- Populates initial business, company profile, subscription plans,
-- measurement templates, tailors, customers, and fabric inventory.
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
) on conflict do nothing;

-- 2. Default Company Profile
insert into public.companies (
  id,
  business_id,
  name,
  legal_name,
  registration_number,
  tax_number,
  address,
  phone,
  email,
  whatsapp,
  currency,
  timezone
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
) on conflict do nothing;

-- 3. Subscription Plans (Yearly & Lifetime)
insert into public.subscription_plans (id, name, price_label, amount, duration_days, payment_url, is_active, sort_order)
values
  ('00000000-0000-0000-0000-000000000011', 'Yearly Pro', 'AED 2,222/yr', 2222.00, 365, 'https://pay.ziina.com/mehar/yearly', true, 1),
  ('00000000-0000-0000-0000-000000000012', 'Lifetime Perpetual', 'AED 3,200 one-time', 3200.00, 36500, 'https://pay.ziina.com/mehar/lifetime', true, 2)
on conflict do nothing;

-- 4. Measurement Templates
insert into public.measurement_templates (name, category, fields, is_active, business_id)
values
  (
    'Kandora / Thobe',
    'Men',
    '[
      {"field_name": "Length", "unit": "inches", "default_value": "58", "is_required": true},
      {"field_name": "Chest", "unit": "inches", "default_value": "42", "is_required": true},
      {"field_name": "Sleeve", "unit": "inches", "default_value": "25", "is_required": true},
      {"field_name": "Collar", "unit": "inches", "default_value": "16.5", "is_required": true},
      {"field_name": "Shoulder", "unit": "inches", "default_value": "18", "is_required": true},
      {"field_name": "Bottom Width", "unit": "inches", "default_value": "30", "is_required": false}
    ]'::jsonb,
    true,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'Suit & Blazer',
    'Men',
    '[
      {"field_name": "Jacket Length", "unit": "inches", "default_value": "30", "is_required": true},
      {"field_name": "Chest", "unit": "inches", "default_value": "40", "is_required": true},
      {"field_name": "Waist", "unit": "inches", "default_value": "34", "is_required": true},
      {"field_name": "Shoulder", "unit": "inches", "default_value": "18.5", "is_required": true},
      {"field_name": "Sleeve", "unit": "inches", "default_value": "25", "is_required": true},
      {"field_name": "Neck", "unit": "inches", "default_value": "16", "is_required": false}
    ]'::jsonb,
    true,
    '00000000-0000-0000-0000-000000000001'
  )
on conflict do nothing;

-- 5. Tailors / Craftsmen
insert into public.tailors (name, phone, email, specialization, rate_type, rate, business_id)
values
  ('Master Rashid', '+971 50 123 4567', 'rashid@thredo.ae', 'Kandora Master', 'piecework', 45.00, '00000000-0000-0000-0000-000000000001'),
  ('Nadeem Tailor', '+971 55 987 6543', 'nadeem@thredo.ae', 'Suits & Tuxedos', 'piecework', 75.00, '00000000-0000-0000-0000-000000000001'),
  ('Farooq Alterations', '+971 52 456 7890', 'farooq@thredo.ae', 'Alterations & Fitting', 'hourly', 30.00, '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- 6. Customers
insert into public.customers (name, phone, email, city, address, business_id)
values
  ('Sultan Al Marzouqi', '+971501234567', 'sultan@almarzouqi.ae', 'Dubai', 'Villa 14, Jumeirah 2', '00000000-0000-0000-0000-000000000001'),
  ('Mohammed Al Mansoori', '+971552345678', 'mohammed@mansoori.ae', 'Abu Dhabi', 'Al Bateen Area', '00000000-0000-0000-0000-000000000001'),
  ('Ahmed Bin Saeed', '+971523456789', 'ahmed@binsaeed.ae', 'Sharjah', 'Al Majaz Waterfront', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- 7. Fabrics & Products Catalog
insert into public.products (name, category, price, cost, stock_quantity, unit, business_id)
values
  ('Japanese Toyobo Cotton (White)', 'Fabric', 85.00, 45.00, 120.0, 'meter', '00000000-0000-0000-0000-000000000001'),
  ('Italian Super 140s Wool (Navy)', 'Fabric', 240.00, 130.00, 45.0, 'meter', '00000000-0000-0000-0000-000000000001'),
  ('English Linen (Cream)', 'Fabric', 110.00, 60.00, 80.0, 'meter', '00000000-0000-0000-0000-000000000001'),
  ('Premium Metallic Cufflinks', 'Accessory', 65.00, 25.00, 30.0, 'piece', '00000000-0000-0000-0000-000000000001'),
  ('Custom Silk Lining', 'Accessory', 35.00, 15.00, 50.0, 'meter', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- 8. Website Configuration (Online Storefront)
insert into public.website_configs (business_id, store_name, slug, online_ordering_enabled, contact_phone, delivery_charge)
values (
  '00000000-0000-0000-0000-000000000001',
  'THREDO Fashion Studio',
  'thredo',
  true,
  '+971 52 872 4090',
  25.00
) on conflict do nothing;
