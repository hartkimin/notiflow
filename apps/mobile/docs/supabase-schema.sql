-- MedNotiV2 Supabase Database Schema
-- Run this SQL in Supabase SQL Editor (Dashboard > SQL Editor)

-- Categories table
create table if not exists categories (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    color integer not null default 0,
    is_deleted boolean not null default false,
    created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
    updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- Status Steps table
create table if not exists status_steps (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    order_index integer not null default 0,
    color integer not null default 0,
    is_deleted boolean not null default false,
    created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
    updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- Filter Rules table
create table if not exists filter_rules (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    category_id text not null,
    sender_keywords text[] not null default '{}',
    sender_match_type text not null default 'CONTAINS',
    sms_phone_number text,
    include_words text[] not null default '{}',
    exclude_words text[] not null default '{}',
    include_match_type text not null default 'OR',
    is_active boolean not null default true,
    is_deleted boolean not null default false,
    created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
    updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- Captured Messages table
create table if not exists captured_messages (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    category_id text,
    matched_rule_id text,
    source text not null,
    app_name text not null,
    sender text not null,
    content text not null,
    status_id text,
    comment text,
    is_archived boolean not null default false,
    is_deleted boolean not null default false,
    received_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
    updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
    status_changed_at bigint
);

-- App Filters table
create table if not exists app_filters (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    package_name text not null,
    app_name text not null,
    is_allowed boolean not null default true,
    is_deleted boolean not null default false,
    updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- Indexes for better query performance
create index if not exists idx_categories_user_id on categories(user_id);
create index if not exists idx_status_steps_user_id on status_steps(user_id);
create index if not exists idx_filter_rules_user_id on filter_rules(user_id);
create index if not exists idx_captured_messages_user_id on captured_messages(user_id);
create index if not exists idx_captured_messages_received_at on captured_messages(received_at);
create index if not exists idx_app_filters_user_id on app_filters(user_id);

-- Row Level Security (RLS) Policies
-- Enable RLS
alter table categories enable row level security;
alter table status_steps enable row level security;
alter table filter_rules enable row level security;
alter table captured_messages enable row level security;
alter table app_filters enable row level security;

-- Categories policies
create policy "Users can view own categories" on categories
    for select using (auth.uid() = user_id);
create policy "Users can insert own categories" on categories
    for insert with check (auth.uid() = user_id);
create policy "Users can update own categories" on categories
    for update using (auth.uid() = user_id);
create policy "Users can delete own categories" on categories
    for delete using (auth.uid() = user_id);

-- Status Steps policies
create policy "Users can view own status_steps" on status_steps
    for select using (auth.uid() = user_id);
create policy "Users can insert own status_steps" on status_steps
    for insert with check (auth.uid() = user_id);
create policy "Users can update own status_steps" on status_steps
    for update using (auth.uid() = user_id);
create policy "Users can delete own status_steps" on status_steps
    for delete using (auth.uid() = user_id);

-- Filter Rules policies
create policy "Users can view own filter_rules" on filter_rules
    for select using (auth.uid() = user_id);
create policy "Users can insert own filter_rules" on filter_rules
    for insert with check (auth.uid() = user_id);
create policy "Users can update own filter_rules" on filter_rules
    for update using (auth.uid() = user_id);
create policy "Users can delete own filter_rules" on filter_rules
    for delete using (auth.uid() = user_id);

-- Captured Messages policies
create policy "Users can view own captured_messages" on captured_messages
    for select using (auth.uid() = user_id);
create policy "Users can insert own captured_messages" on captured_messages
    for insert with check (auth.uid() = user_id);
create policy "Users can update own captured_messages" on captured_messages
    for update using (auth.uid() = user_id);
create policy "Users can delete own captured_messages" on captured_messages
    for delete using (auth.uid() = user_id);

-- App Filters policies
create policy "Users can view own app_filters" on app_filters
    for select using (auth.uid() = user_id);
create policy "Users can insert own app_filters" on app_filters
    for insert with check (auth.uid() = user_id);
create policy "Users can update own app_filters" on app_filters
    for update using (auth.uid() = user_id);
create policy "Users can delete own app_filters" on app_filters
    for delete using (auth.uid() = user_id);

-- Enable Realtime for all tables
alter publication supabase_realtime add table categories;
alter publication supabase_realtime add table status_steps;
alter publication supabase_realtime add table filter_rules;
alter publication supabase_realtime add table captured_messages;
alter publication supabase_realtime add table app_filters;
