-- =============================================================================
-- Migration 007: Create community_posts table  (canonical schema, consolidated)
-- =============================================================================
-- Community board posts: news shared by citizens or admins, plus posts
-- promoted from incident reports by admins. Posts may carry an image
-- OR a video. Reposts are stored as new rows referencing the original via
-- reposted_from_post_id. Reports promoted to posts retain the back-link
-- via promoted_from_report_id.
--
--   category : community | city-news | videos
--   type     : post | video
--
-- Migration 021 added video_path, location, reposted_from_post_id,
-- promoted_from_report_id. This file now reflects the canonical schema;
-- the ALTERs remain and no-op on fresh runs.
-- =============================================================================

CREATE TABLE IF NOT EXISTS community_posts (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                  INTEGER       NOT NULL,
    category                 VARCHAR(20)   NOT NULL DEFAULT 'community',
    type                     VARCHAR(20)   NOT NULL DEFAULT 'post',
    title                    VARCHAR(255)  NOT NULL,
    content                  TEXT          DEFAULT NULL,
    location                 VARCHAR(255)  DEFAULT NULL,
    image_path               VARCHAR(500)  DEFAULT NULL,
    video_path               VARCHAR(500)  DEFAULT NULL,
    reposted_from_post_id    INTEGER       DEFAULT NULL,
    promoted_from_report_id  INTEGER       DEFAULT NULL,
    created_at               DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)                 REFERENCES users(id),
    FOREIGN KEY (reposted_from_post_id)   REFERENCES community_posts(id),
    FOREIGN KEY (promoted_from_report_id) REFERENCES reports(id)
);
