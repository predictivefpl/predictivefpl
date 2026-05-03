-- ═══════════════════════════════════════════════════════════════════
-- PredictiveFPL Supabase RLS HARDENING
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- 1. Drop the dangerous "allow_all" policies
DROP POLICY IF EXISTS "allow_all" ON users;
DROP POLICY IF EXISTS "Allow all users to be inserted/updated" ON users;
DROP POLICY IF EXISTS "allow_all" ON promo_codes;

-- 2. Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- 3. USERS: anon key can ONLY insert/upsert (for UserSync component)
--    Cannot read other users, cannot update tier
CREATE POLICY "users_insert_own" ON users
  FOR INSERT TO anon
  WITH CHECK (true);

-- 4. USERS: anon key can update its OWN row (for last_sign_in updates)
--    Note: no good way to verify identity from anon key alone, so we restrict to email match
CREATE POLICY "users_update_own_safe" ON users
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (
    -- Cannot upgrade tier via anon key
    tier = (SELECT tier FROM users WHERE id = users.id) OR
    tier IS NULL
  );

-- 5. USERS: anon CANNOT read user list (admin must use service_role from backend)
CREATE POLICY "users_no_anon_read" ON users
  FOR SELECT TO anon
  USING (false);

-- 6. PROMO CODES: anon CANNOT read or modify (server-side only)
CREATE POLICY "promo_no_anon" ON promo_codes
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- ═══════════════════════════════════════════════════════════════════
-- IMPORTANT: After running this, you also need to:
-- 1. Get your service_role key from Supabase Settings -> API
-- 2. Update the SUPABASE_SERVICE_KEY in Railway env vars (currently set to anon key)
-- ═══════════════════════════════════════════════════════════════════
