-- Migration to add super admin policies for tenants table

CREATE POLICY "Super admins can perform all actions on tenants" ON tenants
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());
