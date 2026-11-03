SELECT 'CREATE DATABASE fb_outlet_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fb_outlet_test')\gexec
