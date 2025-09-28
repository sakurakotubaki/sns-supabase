# Next.js SNS App
This is SNS App.
Using Supabase with Next.js.

```sql
-- 0) 拡張（UUID生成・タイムスタンプ）
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1) プロフィール：auth.users と 1:1
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (char_length(username) between 3 and 32),
  display_name text,
  bio text,
  avatar_url text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.profiles (username);

-- 更新トリガー
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
before update on public.profiles
for each row execute function public.set_updated_at();

-- auth.users に新規ユーザーが作成されたら profiles を自動生成
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- 2) 投稿テーブル
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  media_url text, -- 画像等（必要なら Storage を別途設定）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_posts_author_created
  on public.posts (author_id, created_at desc);

drop trigger if exists trg_posts_updated on public.posts;
create trigger trg_posts_updated
before update on public.posts
for each row execute function public.set_updated_at();


-- 3) フォロー（中間テーブル）
-- follower_id が following_id をフォローする
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists idx_follows_following on public.follows (following_id);
create index if not exists idx_follows_follower on public.follows (follower_id);


-- 4) RLS（行レベルセキュリティ）
alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.follows  enable row level security;

-- profiles: 自分のプロフィールは自分のみ更新。全員の閲覧は可（必要に応じて制限）。
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- posts: 全件閲覧可。作成/更新/削除は本人のみ。
create policy "posts_select_all"
  on public.posts for select
  using (true);

create policy "posts_insert_own"
  on public.posts for insert
  with check (auth.uid() = author_id);

create policy "posts_update_own"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "posts_delete_own"
  on public.posts for delete
  using (auth.uid() = author_id);

-- follows: 自分→他人 を作成/削除できるのは自分だけ。閲覧は全員可（必要に応じて絞る）。
create policy "follows_select_all"
  on public.follows for select
  using (true);

create policy "follows_insert_self_only"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "follows_delete_self_only"
  on public.follows for delete
  using (auth.uid() = follower_id);


-- 5) ビュー（followers / following をわかりやすく）
-- ユーザー毎のフォロワー一覧
create or replace view public.user_followers as
select
  p.id as user_id,
  f.follower_id,
  pf.username as follower_username,
  pf.display_name as follower_display_name,
  f.created_at as followed_at
from public.follows f
join public.profiles p on p.id = f.following_id
join public.profiles pf on pf.id = f.follower_id;

-- ユーザー毎のフォロー一覧
create or replace view public.user_following as
select
  p.id as user_id,
  f.following_id,
  pt.username as following_username,
  pt.display_name as following_display_name,
  f.created_at as following_since
from public.follows f
join public.profiles p on p.id = f.follower_id
join public.profiles pt on pt.id = f.following_id;

-- （任意）便利ビュー：タイムライン＝自分と自分がフォローしている人の投稿
create or replace view public.timeline as
select
  posts.*
from public.posts
where posts.author_id = auth.uid()
   or posts.author_id in (
        select following_id from public.follows where follower_id = auth.uid()
      );
```