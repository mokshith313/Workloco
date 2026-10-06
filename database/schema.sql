-- WorkLoco: PostgreSQL 16 + PostGIS 3.4 Database Schema
-- Enhanced with Authentication, 2-Step Employer Verification, Scam Reporting, and Real-time Notifications

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SEEKER', 'PROVIDER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'FILLED', 'EXPIRED', 'FLAGGED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE application_status AS ENUM ('APPLIED', 'SHORTLISTED', 'REJECTED', 'HIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('UNVERIFIED', 'PHONE_VERIFIED', 'BUSINESS_VERIFIED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Users Table (Enhanced with Auth & Verification)
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(15) UNIQUE,
    email VARCHAR(150) UNIQUE,
    password_hash TEXT,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'SEEKER',
    avatar_url TEXT,
    bio TEXT,
    preferred_language VARCHAR(10) DEFAULT 'en',
    current_location GEOGRAPHY(POINT, 4326),
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_business_verified BOOLEAN DEFAULT FALSE,
    verification_status verification_status DEFAULT 'UNVERIFIED',
    business_name VARCHAR(150),
    gstin VARCHAR(20),
    pan_number VARCHAR(15),
    pincode VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Master Job Titles (for Hybrid Dropdown)
CREATE TABLE IF NOT EXISTS job_titles (
    title_id SERIAL PRIMARY KEY,
    title_name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Jobs Posting Table with Geospatial & Trust Indexing
CREATE TABLE IF NOT EXISTS jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    custom_title VARCHAR(150),
    category VARCHAR(50) DEFAULT 'General',
    description TEXT NOT NULL,
    salary_min NUMERIC(10, 2),
    salary_max NUMERIC(10, 2),
    is_salary_negotiable BOOLEAN DEFAULT FALSE,
    salary_period VARCHAR(20) DEFAULT 'monthly', -- 'daily', 'monthly', 'per_project'
    location_name TEXT NOT NULL,
    job_location GEOGRAPHY(POINT, 4326) NOT NULL,
    vacancies_count INT DEFAULT 1,
    hired_count INT DEFAULT 0,
    status job_status DEFAULT 'ACTIVE',
    contact_phone VARCHAR(15),
    whatsapp_number VARCHAR(15),
    is_verified_employer BOOLEAN DEFAULT FALSE,
    report_count INT DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs USING GIST(job_location);
CREATE INDEX IF NOT EXISTS idx_jobs_status_expiry ON jobs(status, expires_at);

-- 4. Candidate Applications Table
CREATE TABLE IF NOT EXISTS job_applications (
    application_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    seeker_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    seeker_name VARCHAR(100) NOT NULL,
    seeker_phone VARCHAR(15) NOT NULL,
    portfolio_urls TEXT[],
    audio_intro_url TEXT,
    cover_note TEXT,
    distance_at_apply_km NUMERIC(6, 2),
    status application_status DEFAULT 'APPLIED',
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_application UNIQUE(job_id, seeker_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_seeker ON job_applications(seeker_id);

-- 5. Job Scam & Fraud Reports Table (Security & Trust)
CREATE TABLE IF NOT EXISTS job_reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reporter_contact VARCHAR(100),
    reason VARCHAR(50) NOT NULL, -- 'SCAM_OR_FRAUD', 'ASKS_FOR_MONEY', 'FAKE_LOCATION', 'MISLEADING_SALARY', 'INAPPROPRIATE'
    description TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_job ON job_reports(job_id);

-- 6. Notifications Table (Real-Time Feed for Seekers, Employers & System)
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    target_role VARCHAR(20) NOT NULL, -- 'SEEKER', 'PROVIDER', 'ALL'
    type VARCHAR(50) NOT NULL, -- 'APPLICATION_UPDATE', 'NEW_APPLICANT', 'EXPIRY_WARNING', 'VERIFICATION_UPDATE', 'SECURITY_ALERT'
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    reference_id TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
