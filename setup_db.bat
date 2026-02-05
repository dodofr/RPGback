@echo off
set PGPASSWORD=root
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rpg_user') THEN CREATE USER rpg_user WITH PASSWORD 'rpg_password'; END IF; END $$;"
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "SELECT 'CREATE DATABASE rpg_tactique OWNER rpg_user' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rpg_tactique')\gexec"
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE rpg_tactique TO rpg_user;"
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -d rpg_tactique -c "GRANT ALL ON SCHEMA public TO rpg_user;"
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -d rpg_tactique -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO rpg_user;"
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -d rpg_tactique -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO rpg_user;"
echo Done!
