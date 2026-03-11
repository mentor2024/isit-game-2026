-- 1. Create poll_descriptors table for Word Cloud polls
create table if not exists public.poll_descriptors (
    id uuid default gen_random_uuid() primary key,
    poll_id uuid references public.polls(id) on delete cascade not null,
    word text not null,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.poll_descriptors enable row level security;

-- Policies for poll_descriptors
create policy "Anyone can read poll descriptors"
    on public.poll_descriptors for select
    using (true);

create policy "Authenticated users can insert poll descriptors"
    on public.poll_descriptors for insert
    to authenticated
    with check (true);

-- Indexes for fast lookups
create index idx_poll_descriptors_poll_id on public.poll_descriptors(poll_id);
create index idx_poll_descriptors_word on public.poll_descriptors(word);

-- 2. Add JSONB column to poll_votes to store the ranked arrays
alter table public.poll_votes 
add column if not exists vote_data jsonb;

