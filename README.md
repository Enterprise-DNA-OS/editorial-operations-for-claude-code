# Editorial Operations for Claude Code

Own your editorial deadlines, copy and review history. An open-source database for a marketing team's daily production work, created by Enterprise DNA. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free, MIT. Install and run the database. | Your fields, review rules and StoryChief records brought across. A web front end or different stack by agreement. | Installed, connected and operated through Omni by Enterprise DNA. One setup fee, then a retainer. |

[Book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=storychief)

## What it does

A marketing manager checks the editorial week, chases pending reviews, verifies claim evidence, clears production tasks and prepares a publication handover. Writers keep immutable revisions. Approval is specific to the exact revision. The database preserves imported source records and every logged change. Read-only branded documents show the brief, approval record and campaign handover.

[StoryChief Enterprise starts at EUR 1,000+ per month, billed yearly](https://www.storychief.io/pricing), or EUR 12,000+ for twelve months, checked 27 October 2026. This is a published starting price, not a customer invoice. Lower plans exist. This free base covers editorial records and handovers. Website publishing, social distribution, media generation and live analytics connections are custom integration work. There is no assertion that it replaces every StoryChief feature.

## Quick start

Node 20 or newer. No database server needed for the embedded demo.

```bash
npm install
npm run demo
node scripts/editorial.mjs editorial-week
node scripts/editorial.mjs publication-handover
node scripts/editorial.mjs insights --json
npm run view
npm run docs
npm test
```

The demo uses fictional records and relative dates. For your own records use a new DATA_DIR and npm run migrate without seeding, or set DATABASE_URL to a dedicated Postgres database. All statements are compatible with PostgreSQL and PGlite. See docs/verification.md for actual tested environments. The demo never calls a vendor or sends anything.

## Commands

- `help`
- `campaigns`
- `stories`
- `show`: `<story>`
- `editorial-week`
- `approval-chase`
- `claims-review`
- `production-tasks`
- `publication-handover`
- `content-refresh`
- `performance`
- `attention`
- `compliance`
- `insights`
- `history`: `<story>`
- `add-campaign`: `--code= --name= --objective= --owner= --ends= --actor=`
- `add`: `--code= --campaign= --title= --owner= --due= --body-file= --brief= [--channel= --language=] --actor=`
- `revise`: `<story> --body-file= [--title=] --actor=`
- `assign`: `<story> --owner= --due= --actor=`
- `request-review`: `<story> --reviewer= --due= --actor=`
- `review`: `<story> --reviewer= --decision=approved|changes --note= --actor=`
- `claim`: `<story> --claim= --source= --reviewer= --checked= --until= --actor=`
- `check-claims`: `<story> --advertising=yes|no --disclosure= --note= --actor=`
- `add-task`: `<story> --code= --title= --owner= --due= --actor=`
- `complete-task`: `<task> --actor=`
- `log`: `<story> --note= --actor=`
- `ready`: `<story> --actor=`
- `record-publication`: `<story> --url= --date= --actor=`
- `record-metrics`: `<story> --date= --views= --leads= --source= --actor=`
- `archive`: `<story> --note= --actor=`
- `import`: `storychief <saved-json-file-or-folder> --source= --campaign= --actor= [--dry-run]`
- `export`: `--out=<new.json>`
- `weekly-review`
- `draft-brief`: `<story>`
- `draft-handover`: `<story>`

Prefix each with node scripts/editorial.mjs. Every command supports --json. The matching slash-command recipes are in .claude/commands. /customise adds a field or rule through a migration. /new-view adds a read-only report.

## Bring your history

Save StoryChief's documented Get Stories and Get Story responses as JSON. Retrieve all pages with status=all and detail content included. Save a single account's files in imports/storychief/.

```bash
node scripts/editorial.mjs import storychief imports/storychief --source=our-account --campaign=AUTUMN --actor=Operator --dry-run
node scripts/editorial.mjs import storychief imports/storychief --source=our-account --campaign=AUTUMN --actor=Operator
node scripts/editorial.mjs export --out=exports/editorial.json
```

One command loads the saved export. Exporting from the vendor is a separate step. Missing content is counted. Imported articles start draft with no approved claims or reviewers. Published dates are preserved as source history and do not authorise a new publication. Unchanged rows do not duplicate. A changed source row aborts the entire batch for reconciliation. The importer reads only the files you supply and cannot detect omitted pages. [Exact mapping and limits](docs/replace-storychief.md).

## Ten questions to ask

The insights command answers these from current records. These are useful combinations of local evidence, not a claim that StoryChief cannot be configured to answer similar questions.

1. Which overdue articles also have outstanding reviews?
2. Which near-term articles lack an owner?
3. Which current drafts rely on expired evidence?
4. Which published articles have no recorded results?
5. Which articles have visits but no enquiries?
6. Which campaigns contain stale unfinished content?
7. Which writers have overdue production tasks?
8. Which reviewed articles still lack an advertising decision?
9. Which articles can be handed over with no outstanding checks?
10. Which edits have left historical approvals behind?

## Your first hour: ten things to ask for

1. Put our business name, logo and colours in brand.json.
2. Add our next campaign and its owner.
3. Preview one complete saved StoryChief account export.
4. Reconcile every exported page and article count.
5. Assign the imported drafts to writers and deadlines.
6. Add the first complete article revision.
7. Request an editorial and a factual review.
8. Record sources for its claims and its advertising identification.
9. Clear production tasks and prepare the campaign handover.
10. Add our approval category through /customise.

## Documents, views and evidence

Change brand.json once. npm run docs creates three document types under docs-out/. npm run view creates the week, approval and results reports under views/. All are read-only HTML with escaped record text. Imported article HTML is shown as source text, never executed. /draft-brief and /draft-handover write new Markdown files in drafts/, never send.

/compliance checks whether recorded evidence supports the review process under cited NZ advertising principles. It cannot decide whether copy is true or legally compliant. Expiry and seven-day metric freshness are local editorial policies, not statutory time limits. See [compliance sources](docs/compliance.md) and [why no front end](docs/why-no-front-end.md).

## Operating boundaries

One organisation and trusted internal operators. No sign-in, tenant isolation, live feeds, drag-and-drop editor, mobile capture or offline sync. Actor labels are not authentication. Database owners can bypass access restrictions. configure limited roles and secured backups for shared use. No automatic publication, messaging, payment, external model calls or secret handling. No licensed content library is included.

The JSON export covers all nine domain relations. it is portable data, not a tested backup restore. Use native database backups for recovery. Output files use restrictive permissions where supported and exports refuse overwrites. Keep real records out of git.

MIT. Built by Enterprise DNA.
