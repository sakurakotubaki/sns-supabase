-- Enrich timeline view with author profile fields
create or replace view public.timeline as
select
  posts.id,
  posts.author_id,
  posts.body,
  posts.media_url,
  posts.created_at,
  posts.updated_at,
  p.username,
  p.display_name
from public.posts
join public.profiles p on p.id = posts.author_id
where posts.author_id = auth.uid()
   or posts.author_id in (
        select following_id from public.follows where follower_id = auth.uid()
      )
order by posts.created_at desc;

