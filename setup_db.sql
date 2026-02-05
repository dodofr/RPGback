-- Create user if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rpg_user') THEN
        CREATE USER rpg_user WITH PASSWORD 'rpg_password';
    END IF;
END
$$;

-- Create database if not exists
SELECT 'CREATE DATABASE rpg_tactique OWNER rpg_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rpg_tactique')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE rpg_tactique TO rpg_user;

-- Connect to rpg_tactique and grant schema privileges
\c rpg_tactique
GRANT ALL ON SCHEMA public TO rpg_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rpg_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rpg_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO rpg_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO rpg_user;
