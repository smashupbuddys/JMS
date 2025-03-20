-- Set password for admin user
UPDATE auth.users
SET encrypted_password = crypt('@pplepie9229S', gen_salt('bf'))
WHERE email = 'smash@gmail.com'; 