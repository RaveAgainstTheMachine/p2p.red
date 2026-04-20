-- P2P File Share - Metadata Database Schema
-- Optimized for high-throughput short link generation and retrieval

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Short links table
CREATE TABLE IF NOT EXISTS short_links (
    id BIGSERIAL PRIMARY KEY,
    short_key VARCHAR(16) UNIQUE NOT NULL,
    peer_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) DEFAULT 'application/octet-stream',
    pin_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_short_key ON short_links(short_key);
CREATE INDEX IF NOT EXISTS idx_expires_at ON short_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_peer_id ON short_links(peer_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON short_links(created_at DESC);

-- Function to clean up expired links
CREATE OR REPLACE FUNCTION cleanup_expired_links()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM short_links
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (requires pg_cron extension)
-- If pg_cron is not available, cleanup will be handled by the API server
-- SELECT cron.schedule('cleanup-expired-links', '0 * * * *', 'SELECT cleanup_expired_links()');

-- Analytics table (optional, for tracking link usage)
CREATE TABLE IF NOT EXISTS link_analytics (
    id BIGSERIAL PRIMARY KEY,
    short_key VARCHAR(16) NOT NULL,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET,
    FOREIGN KEY (short_key) REFERENCES short_links(short_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analytics_short_key ON link_analytics(short_key);
CREATE INDEX IF NOT EXISTS idx_analytics_accessed_at ON link_analytics(accessed_at DESC);

-- View for link statistics
CREATE OR REPLACE VIEW link_stats AS
SELECT 
    sl.short_key,
    sl.file_name,
    sl.created_at,
    sl.expires_at,
    sl.access_count,
    COUNT(la.id) as detailed_access_count,
    MAX(la.accessed_at) as last_access_time
FROM short_links sl
LEFT JOIN link_analytics la ON sl.short_key = la.short_key
GROUP BY sl.short_key, sl.file_name, sl.created_at, sl.expires_at, sl.access_count;

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    rating INTEGER,
    email VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Grant permissions (adjust username as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO p2p_api_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO p2p_api_user;
