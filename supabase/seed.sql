insert into campaigns(id,code,name,objective,owner,ends_on) values
 ('10000000-0000-0000-0000-000000000001','AUTUMN','Autumn product education','Explain stock care to wholesale buyers','Morgan',current_date+40),
 ('10000000-0000-0000-0000-000000000002','PARTNERS','Partner briefing','Prepare distributor education','Casey',current_date+60) on conflict do nothing;
insert into stories(id,code,campaign_id,title,owner,due_on,brief,last_activity_on,advertising,disclosure,claims_checked,status) values
 ('20000000-0000-0000-0000-000000000001','ED-001','10000000-0000-0000-0000-000000000001','Winter stock checklist','Alex',current_date-3,'Give warehouse buyers a practical stock checklist.',current_date-20,'yes','Sponsored by Example Supply',false,'review'),
 ('20000000-0000-0000-0000-000000000002','ED-002','10000000-0000-0000-0000-000000000001','Packaging claims explainer','',current_date+4,'Verify each packaging claim before release.',current_date-18,'yes','',false,'draft'),
 ('20000000-0000-0000-0000-000000000003','ED-003','10000000-0000-0000-0000-000000000002','Distributor welcome guide','Casey',current_date+2,'Welcome new distributors with an approved handover.',current_date,'no','',true,'review'),
 ('20000000-0000-0000-0000-000000000004','ED-004','10000000-0000-0000-0000-000000000002','Ordering guide','Taylor',current_date-40,'Explain the ordering process.',current_date-40,'no','',true,'published'),
 ('20000000-0000-0000-0000-000000000005','ED-005','10000000-0000-0000-0000-000000000002','Delivery guide','Taylor',current_date-35,'Explain delivery windows.',current_date-35,'no','',true,'published') on conflict do nothing;
insert into revisions(story_id,number,title,body,author) select id,1,title,case code when 'ED-001' then 'Check your labels and count stock before the winter order.' when 'ED-002' then 'Our packaging contains recycled material. Evidence still needs review.' when 'ED-003' then 'Welcome. Your account coordinator will confirm your first order requirements.' else 'Review the agreed order and delivery instructions with your coordinator.' end,'Demo editor' from stories where code like 'ED-%' on conflict do nothing;
insert into reviews(story_id,revision,reviewer,due_on,decision,note,decided_on) values
 ('20000000-0000-0000-0000-000000000001',1,'Morgan',current_date-2,'pending','',null),
 ('20000000-0000-0000-0000-000000000003',1,'Morgan',current_date,'approved','No factual claims requiring support in this introduction.',current_date) on conflict do nothing;
insert into claims(id,story_id,revision,claim,source,reviewer,checked_on,valid_until) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',1,'Packaging contains recycled material','demo://supplier-previous-specification','Casey',current_date-90,current_date-2) on conflict do nothing;
insert into tasks(code,story_id,title,owner,due_on) values
 ('TASK-001','20000000-0000-0000-0000-000000000001','Verify checklist against warehouse procedure','Alex',current_date-4),
 ('TASK-002','20000000-0000-0000-0000-000000000002','Obtain current supplier evidence','Casey',current_date+1) on conflict do nothing;
update stories set published_on=current_date-40,publication_url='https://example.com/ordering' where code='ED-004' and published_on is null;
update stories set published_on=current_date-35,publication_url='https://example.com/delivery' where code='ED-005' and published_on is null;
insert into metrics(story_id,observed_on,views,leads,source) values ('20000000-0000-0000-0000-000000000004',current_date-10,1200,0,'demo://analytics-snapshot') on conflict do nothing;
