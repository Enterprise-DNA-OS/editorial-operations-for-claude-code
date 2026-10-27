create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function immutable_record() returns trigger language plpgsql as $$ begin raise exception 'History is append-only'; end $$;
create table campaigns (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 objective text not null, owner text not null, ends_on date not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table stories (
 id uuid primary key default gen_random_uuid(), code text not null unique, campaign_id uuid not null references campaigns,
 title text not null, owner text not null default '', channel text not null default 'website',
 language text not null default 'en', due_on date, brief text not null default '',
 status text not null default 'draft' check(status in ('draft','review','ready','published','archived')),
 revision integer not null default 1 check(revision>0), claims_checked boolean not null default false,
 advertising text not null default 'unknown' check(advertising in ('unknown','yes','no')),
 disclosure text not null default '', source_namespace text, source_id text, source_record jsonb,
 source_hash text, source_published_at timestamptz, source_updated_at timestamptz,
 publication_url text, published_on date, last_activity_on date not null default current_date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(source_namespace,source_id)
);
create table revisions (
 id uuid primary key default gen_random_uuid(), story_id uuid not null references stories,
 number integer not null, title text not null, body text not null, author text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(story_id,number)
);
create table reviews (
 id uuid primary key default gen_random_uuid(), story_id uuid not null references stories,
 revision integer not null, reviewer text not null, due_on date not null,
 decision text not null default 'pending' check(decision in ('pending','approved','changes')),
 note text not null default '', decided_on date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(story_id,revision) references revisions(story_id,number), unique(story_id,revision,reviewer)
);
create table claims (
 id uuid primary key default gen_random_uuid(), story_id uuid not null references stories,
 revision integer not null, claim text not null, source text not null, reviewer text not null,
 checked_on date not null, valid_until date not null, check(valid_until>=checked_on),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(story_id,revision) references revisions(story_id,number)
);
create table tasks (
 id uuid primary key default gen_random_uuid(), code text not null unique, story_id uuid not null references stories,
 title text not null, owner text not null, due_on date not null, closed_on date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table metrics (
 id uuid primary key default gen_random_uuid(), story_id uuid not null references stories,
 observed_on date not null, views integer not null check(views>=0), leads integer not null check(leads>=0),
 source text not null, check(leads<=views),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(story_id,observed_on)
);
create table activity (
 id uuid primary key default gen_random_uuid(), story_id uuid references stories, actor text not null,
 action text not null, detail jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table imports (
 id uuid primary key default gen_random_uuid(), namespace text not null, digest text not null,
 row_count integer not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['campaigns','stories','reviews','tasks'] loop
 execute format('create trigger touch before update on %I for each row execute function touch_updated_at()',t);
 end loop;
 foreach t in array array['revisions','claims','activity','imports','metrics'] loop
 execute format('create trigger frozen before update or delete on %I for each row execute function immutable_record()',t);
 end loop;
 foreach t in array array['campaigns','stories','revisions','reviews','claims','tasks','metrics','activity','imports'] loop
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 end loop;
end $$;
create view v_editorial as
 select s.id,s.code,s.title,c.code as campaign,s.owner,s.channel,s.language,s.status,s.revision,s.due_on,s.last_activity_on,
 (select count(*)::int from reviews r where r.story_id=s.id and r.revision=s.revision and decision<>'approved') as reviews_waiting,
 (select count(*)::int from reviews r where r.story_id=s.id and r.revision=s.revision) as reviews_total,
 (select count(*)::int from tasks t where t.story_id=s.id and closed_on is null) as tasks_open,
 (select count(*)::int from claims e where e.story_id=s.id and e.revision=s.revision and valid_until<greatest(current_date,coalesce(s.due_on,current_date))) as expired_evidence,
 s.claims_checked,s.advertising,s.disclosure,s.source_namespace,s.source_id,s.publication_url,s.published_on,
 coalesce((select body<>'' from revisions r where r.story_id=s.id and r.number=s.revision),false) as has_content
 from stories s join campaigns c on c.id=s.campaign_id;
create view v_readiness as
 select *, (owner<>'' and due_on is not null and has_content and reviews_total>0 and reviews_waiting=0 and tasks_open=0 and expired_evidence=0 and claims_checked and advertising<>'unknown' and (advertising='no' or disclosure<>'')) as can_handover from v_editorial;
create view v_attention as
 select code,title,owner,due_on,'Past editorial deadline' as reason from v_editorial where due_on<current_date and status not in ('published','archived')
 union all select code,title,owner,due_on,'No activity for fourteen days' from v_editorial where last_activity_on<current_date-14 and status not in ('published','archived')
 union all select code,title,owner,due_on,'Missing accountable owner' from v_editorial where owner='' and status not in ('published','archived')
 union all select s.code,t.title,t.owner,t.due_on,'Overdue production task' from tasks t join stories s on s.id=t.story_id where t.closed_on is null and t.due_on<current_date and s.status<>'archived';
create view v_review_queue as select s.code,s.title,r.revision,r.reviewer,r.due_on,r.decision,r.note from reviews r join stories s on s.id=r.story_id and s.revision=r.revision where s.status not in ('published','archived');
create view v_performance as
 select s.code,s.title,c.code as campaign,s.published_on,m.observed_on,m.views,m.leads,m.source,
 case when m.views>0 then round(100.0*m.leads/m.views,2) end as lead_rate_percent
 from stories s join campaigns c on c.id=s.campaign_id left join lateral (select * from metrics where story_id=s.id order by observed_on desc limit 1) m on true where s.status='published';
revoke all on v_editorial,v_readiness,v_attention,v_review_queue,v_performance from public;
create unique index reviews_reviewer_case on reviews(story_id,revision,lower(reviewer));
create index tasks_story on tasks(story_id);
create index claims_story on claims(story_id,revision);
create index activity_story on activity(story_id,created_at);
create index stories_due on stories(due_on);
