# Replace the editorial records in StoryChief

## Export from StoryChief

The vendor's [article export guide](https://help.storychief.io/en/articles/13214566-can-i-export-my-articles), checked 27 October 2026, documents Get Stories and Get Story through its [API reference](https://developers.storychief.io/). The account owner uses their own authorised export process. Do not save a token in this repo.

Get Stories defaults to published records and paginates. Select status=all, choose the language and source filters deliberately, and save every page. Request Get Story for every id with content and the extra fields you need. Save responses as JSON, one account per folder. The importer accepts the documented data array, the documented data object, or an array of raw story objects. Summary and detail responses for the same id merge, provided shared title, content and update timestamp agree. Conflicting snapshots abort.

The documented Word and PDF article downloads are readable documents, not supported import formats. CSV is not claimed as a StoryChief article export.

## Import once, after preview

Create a destination campaign. Run:

```bash
node scripts/editorial.mjs import storychief imports/storychief --source=our-account --campaign=AUTUMN --actor=Operator --dry-run
node scripts/editorial.mjs import storychief imports/storychief --source=our-account --campaign=AUTUMN --actor=Operator
```

One import command loads all the saved JSON files. It reports rows read, added, unchanged and missing content. Preview rolls back all changes. A bad row rolls back the batch. Same source namespace plus source id is stable. Changed saved records cause a refusal, so a repeated vendor export cannot overwrite local edits. Reconcile changes through revise after inspection.

## What maps

| StoryChief value | Destination |
|---|---|
| id | source_id scoped by the account name you supply |
| title | current title and initial revision title |
| content | initial revision body, preserved as source text |
| language | language |
| excerpt | starting brief |
| due_at | UTC editorial due date. original timestamp remains in source_record |
| published_at, updated_at | original source timestamps |
| Entire exported object | source_record, including any returned author, tags, categories, destinations, metrics and custom fields |

## What you reconcile

Confirm saved page counts against the source account, including drafted, scheduled and translated articles. This tool cannot detect pages you did not export. Inspect a sample of source text and image references. Asset URLs remain references. no images, videos or linked files are downloaded. No credentials, destinations, social posts, comments, campaign memberships, tasks, review permissions or prior approvals are recreated as active workflow. They are preserved only if present in the returned object. Choose your destination campaign explicitly. Source authors are historical metadata. assign an accountable owner locally.

All imported articles begin as draft, without local approvals or claims review. Historical published timestamps are not evidence that the imported copy was approved. Website hosting, distribution, media processing, search analysis and live results feeds require their own connections. Enterprise DNA scopes that work with you. Run both editorial records side by side for one review cycle and reconcile totals before ending a subscription.
