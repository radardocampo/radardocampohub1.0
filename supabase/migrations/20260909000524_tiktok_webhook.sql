create table public.tiktok_webhook_events (
    id uuid default gen_random_uuid() primary key,
    event_type text not null,
    payload jsonb not null,
    received_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tiktok_webhook_events enable row level security;

create policy "Enable insert for authenticated and anon"
    on public.tiktok_webhook_events
    for insert
    to authenticated, anon
    with check (true);

create policy "Enable read access for authenticated users only"
    on public.tiktok_webhook_events
    for select
    to authenticated
    using (true);
