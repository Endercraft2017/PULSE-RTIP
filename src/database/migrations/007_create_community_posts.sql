-- =============================================================================
-- Migration 007: Create community_posts table
-- =============================================================================
-- Stores community board posts (news, updates, incident reports shared publicly).
-- Each post belongs to a user and has a category (community, city-news, videos).
-- =============================================================================

CREATE TABLE IF NOT EXISTS community_posts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    category        VARCHAR(20) NOT NULL DEFAULT 'community',
    title           VARCHAR(255) NOT NULL,
    content         TEXT,
    image_path      VARCHAR(500),
    type            VARCHAR(20) NOT NULL DEFAULT 'post',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
