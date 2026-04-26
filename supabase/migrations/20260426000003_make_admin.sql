-- Migration to promote duncanprono47@gmail.com to admin
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get the user_id from the profiles table based on the email
    SELECT user_id INTO target_user_id FROM public.profiles WHERE email = 'duncanprono47@gmail.com';

    IF target_user_id IS NOT NULL THEN
        -- Update the role to 'admin' in user_roles
        UPDATE public.user_roles 
        SET role = 'admin'::public.app_role 
        WHERE user_id = target_user_id;
        
        -- If for some reason they don't have any role record (rare due to trigger), insert it
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin'::public.app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
        
        RAISE NOTICE 'User duncanprono47@gmail.com has been promoted to admin.';
    ELSE
        RAISE WARNING 'User with email duncanprono47@gmail.com not found in profiles.';
    END IF;
END $$;
