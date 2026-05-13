-- =============================================================================
-- Migration 022: Create post_edits table (edit history for community posts)
-- =============================================================================
-- U-6: every time an author edits their own post, we snapshot the old title
-- and content here before overwriting the row. The detail modal's "See edit
-- history" link lists these oldest-first so users can see the full trail.
-- =============================================================================

CREATE TABLE IF NOT EXISTS post_edits (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id         INTEGER NOT NULL,
    editor_user_id  INTEGER NOT NULL,
    old_title       VARCHAR(255),
    old_content     TEXT,
    edited_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(id),
    FOREIGN KEY (editor_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_post_edits_post ON post_edits(post_id, edited_at);
