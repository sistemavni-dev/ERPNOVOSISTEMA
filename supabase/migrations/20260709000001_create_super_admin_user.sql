-- Migration to create the super admin user using a safe PL/pgSQL block

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    user_id UUID;
BEGIN
    -- Check if user already exists
    SELECT id INTO user_id FROM auth.users WHERE email = 'sistemavni@gmail.com';

    IF user_id IS NULL THEN
        -- Insert new user
        INSERT INTO auth.users (
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        )
        VALUES (
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'sistemavni@gmail.com',
            crypt('Candi@!999', gen_salt('bf', 10)),
            now(),
            '{"provider": "email", "providers": ["email"], "role": "super_admin"}'::jsonb,
            '{}'::jsonb,
            now(),
            now()
        );
    ELSE
        -- Update existing user
        UPDATE auth.users
        SET encrypted_password = crypt('Candi@!999', gen_salt('bf', 10)),
            raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb
        WHERE id = user_id;
    END IF;
END $$;
