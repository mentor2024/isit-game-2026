-- ============================================================
-- Migration: Register existing poll object images in the
-- assets table so they appear in the Repository.
--
-- Run this once in the Supabase SQL editor.
-- Files stay in the poll_images bucket — we just register them.
-- poll_objects.image_url is NOT changed (both URLs keep working).
-- ============================================================

insert into assets (
    title,
    filename,
    storage_path,
    public_url,
    asset_type,
    mime_type,
    file_size,
    tags,
    description,
    attribution
)
select
    -- Title: derive from the poll title + object text/position
    coalesce(
        nullif(trim(po.text), ''),
        'Poll image ' || po.id
    ) as title,

    -- Filename: extract the last segment of the URL path
    split_part(po.image_url, '/', -1) as filename,

    -- storage_path: we don't own this file in the assets bucket,
    -- so use a sentinel that marks it as an external/legacy reference.
    -- Set to the full URL so the app can still serve it.
    po.image_url as storage_path,

    po.image_url as public_url,

    'image' as asset_type,
    'image/jpeg' as mime_type,   -- best guess; update manually if needed
    0 as file_size,              -- unknown; update manually if needed

    array['poll-image']::text[] as tags,

    -- Description: include which poll it came from
    'From poll: ' || coalesce(p.title, po.poll_id::text) as description,

    null as attribution

from poll_objects po
join polls p on p.id = po.poll_id
where
    po.image_url is not null
    and po.image_url <> ''
    -- Skip any already registered
    and not exists (
        select 1 from assets a where a.public_url = po.image_url
    )
order by p.created_at desc, po.id;

-- How many were inserted?
select count(*) as newly_registered_assets from assets where 'poll-image' = any(tags);
