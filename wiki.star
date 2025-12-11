# Mochi wiki app
# Copyright Alistair Cunningham 2025

# Database creation

def database_create(db):
    db.exec("create table pages (id text primary key, page text not null unique, title text not null, content text not null, author text not null, created integer not null, updated integer not null, version integer not null default 1, deleted integer not null default 0)")
    db.exec("create table revisions (id text primary key, page text not null references pages(id), content text not null, title text not null, author text not null, created integer not null, version integer not null, comment text not null default '')")
    db.exec("create table tags (page text not null references pages(id), tag text not null, primary key (page, tag))")
    db.exec("create table redirects (source text primary key, target text not null, created integer not null)")
    db.exec("create table settings (name text primary key, value text not null)")
    db.exec("create index pages_updated on pages(updated)")
    db.exec("create index pages_author on pages(author)")
    db.exec("create index revisions_page on revisions(page)")
    db.exec("create index revisions_created on revisions(created)")
    db.exec("create index tags_tag on tags(tag)")
    db.exec("insert into settings (name, value) values ('home', 'home')")

# Helper: Get wiki setting
def get_setting(name, default):
    row = mochi.db.row("select value from settings where name = ?", name)
    if row:
        return row["value"]
    return default

# Helper: Get page by slug, following redirects
def get_page(slug):
    # Check for redirect first
    redirect = mochi.db.row("select target from redirects where source = ?", slug)
    if redirect:
        slug = redirect["target"]

    page = mochi.db.row("select * from pages where page = ? and deleted = 0", slug)
    return page

# Helper: Create a revision for a page
def create_revision(page_id, title, content, author, version, comment):
    revision_id = mochi.uid()
    now = mochi.time.now()
    mochi.db.query("insert into revisions (id, page, content, title, author, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, ?)",
        revision_id, page_id, content, title, author, now, version, comment)
    return revision_id

# ACTIONS

# View a page
def action_page(a):
    slug = a.param("page")
    if not slug:
        a.error(400, "Missing page parameter")
        return

    page = get_page(slug)
    if not page:
        a.json({"error": "not_found", "page": slug})
        return

    # Get tags for this page
    tags = mochi.db.query("select tag from tags where page = ?", page["id"])
    tag_list = [t["tag"] for t in tags]

    a.json({
        "page": {
            "id": page["id"],
            "slug": page["page"],
            "title": page["title"],
            "content": page["content"],
            "author": page["author"],
            "created": page["created"],
            "updated": page["updated"],
            "version": page["version"],
            "tags": tag_list
        }
    })

# Edit a page (create or update)
def action_page_edit(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    slug = a.param("page")
    if not slug:
        a.error(400, "Missing page parameter")
        return

    title = a.input("title")
    content = a.input("content")
    comment = a.input("comment", "")

    if not title:
        a.error(400, "Title is required")
        return

    if content == None:
        content = ""

    now = mochi.time.now()
    author = a.user.identity.id

    # Check if page exists
    existing = mochi.db.row("select * from pages where page = ?", slug)

    if existing:
        # Update existing page
        if existing["deleted"]:
            # Restore deleted page
            new_version = existing["version"] + 1
            mochi.db.query("update pages set title = ?, content = ?, author = ?, updated = ?, version = ?, deleted = 0 where id = ?",
                title, content, author, now, new_version, existing["id"])
            create_revision(existing["id"], title, content, author, new_version, comment)
            a.json({"id": existing["id"], "slug": slug, "version": new_version, "created": False})
        else:
            # Update page
            new_version = existing["version"] + 1
            mochi.db.query("update pages set title = ?, content = ?, author = ?, updated = ?, version = ? where id = ?",
                title, content, author, now, new_version, existing["id"])
            create_revision(existing["id"], title, content, author, new_version, comment)
            a.json({"id": existing["id"], "slug": slug, "version": new_version, "created": False})
    else:
        # Create new page
        page_id = mochi.uid()
        mochi.db.query("insert into pages (id, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, 1)",
            page_id, slug, title, content, author, now, now)
        create_revision(page_id, title, content, author, 1, comment)
        a.json({"id": page_id, "slug": slug, "version": 1, "created": True})

# Create a new page (returns page slug for redirect)
def action_new(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    slug = a.input("slug")
    title = a.input("title")
    content = a.input("content", "")

    if not slug:
        a.error(400, "Slug is required")
        return

    if not title:
        a.error(400, "Title is required")
        return

    # Check if slug is reserved
    if slug.startswith("-"):
        a.error(400, "Page names starting with - are reserved")
        return

    # Check if page already exists
    existing = mochi.db.row("select id from pages where page = ?", slug)
    if existing:
        a.error(409, "Page already exists")
        return

    # Create the page
    now = mochi.time.now()
    author = a.user.identity.id
    page_id = mochi.uid()

    mochi.db.query("insert into pages (id, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, 1)",
        page_id, slug, title, content, author, now, now)
    create_revision(page_id, title, content, author, 1, "Initial creation")

    a.json({"id": page_id, "slug": slug})

# Page history (stub - to be implemented in Stage 3)
def action_page_history(a):
    slug = a.param("page")
    if not slug:
        a.error(400, "Missing page parameter")
        return

    page = mochi.db.row("select * from pages where page = ?", slug)
    if not page:
        a.error(404, "Page not found")
        return

    revisions = mochi.db.query("select id, title, author, created, version, comment from revisions where page = ? order by version desc", page["id"])
    a.json({"page": slug, "revisions": revisions})

# View a specific revision
def action_page_revision(a):
    slug = a.param("page")
    version = a.param("version")

    if not slug:
        a.error(400, "Missing page parameter")
        return

    if not version:
        a.error(400, "Missing version parameter")
        return

    page = mochi.db.row("select * from pages where page = ?", slug)
    if not page:
        a.error(404, "Page not found")
        return

    revision = mochi.db.row("select * from revisions where page = ? and version = ?", page["id"], int(version))
    if not revision:
        a.error(404, "Revision not found")
        return

    a.json({
        "page": slug,
        "revision": {
            "id": revision["id"],
            "title": revision["title"],
            "content": revision["content"],
            "author": revision["author"],
            "created": revision["created"],
            "version": revision["version"],
            "comment": revision["comment"]
        },
        "current_version": page["version"]
    })

# Revert to a previous revision
def action_page_revert(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    slug = a.param("page")
    version = a.input("version")
    comment = a.input("comment", "")

    if not slug:
        a.error(400, "Missing page parameter")
        return

    if not version:
        a.error(400, "Version is required")
        return

    page = mochi.db.row("select * from pages where page = ?", slug)
    if not page:
        a.error(404, "Page not found")
        return

    revision = mochi.db.row("select * from revisions where page = ? and version = ?", page["id"], int(version))
    if not revision:
        a.error(404, "Revision not found")
        return

    # Create new version with content from old revision
    now = mochi.time.now()
    author = a.user.identity.id
    new_version = page["version"] + 1

    if not comment:
        comment = "Reverted to version " + str(version)

    mochi.db.query("update pages set title = ?, content = ?, author = ?, updated = ?, version = ? where id = ?",
        revision["title"], revision["content"], author, now, new_version, page["id"])
    create_revision(page["id"], revision["title"], revision["content"], author, new_version, comment)

    a.json({"slug": slug, "version": new_version, "reverted_from": int(version)})

# Add a tag to a page
def action_tag_add(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    slug = a.param("page")
    tag = a.input("tag")

    if not slug:
        a.error(400, "Missing page parameter")
        return

    if not tag:
        a.error(400, "Tag is required")
        return

    # Normalize tag (lowercase, trim)
    tag = tag.lower().strip()
    if not tag:
        a.error(400, "Tag is required")
        return

    page = mochi.db.row("select id from pages where page = ? and deleted = 0", slug)
    if not page:
        a.error(404, "Page not found")
        return

    # Check if tag already exists
    existing = mochi.db.row("select 1 from tags where page = ? and tag = ?", page["id"], tag)
    if existing:
        a.json({"ok": True, "added": False})
        return

    mochi.db.query("insert into tags (page, tag) values (?, ?)", page["id"], tag)
    a.json({"ok": True, "added": True})

# Remove a tag from a page
def action_tag_remove(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    slug = a.param("page")
    tag = a.input("tag")

    if not slug:
        a.error(400, "Missing page parameter")
        return

    if not tag:
        a.error(400, "Tag is required")
        return

    tag = tag.lower().strip()

    page = mochi.db.row("select id from pages where page = ? and deleted = 0", slug)
    if not page:
        a.error(404, "Page not found")
        return

    mochi.db.query("delete from tags where page = ? and tag = ?", page["id"], tag)
    a.json({"ok": True})

# List all tags in the wiki
def action_tags(a):
    tags = mochi.db.query("select tag, count(*) as count from tags group by tag order by count desc, tag asc")
    a.json({"tags": tags})

# List pages with a specific tag
def action_tag_pages(a):
    tag = a.param("tag")

    if not tag:
        a.error(400, "Missing tag parameter")
        return

    tag = tag.lower().strip()

    pages = mochi.db.query("""
        select p.page, p.title, p.updated
        from pages p
        join tags t on t.page = p.id
        where t.tag = ? and p.deleted = 0
        order by p.updated desc
    """, tag)

    a.json({"tag": tag, "pages": pages})

# Search (stub - to be implemented in Stage 6)
def action_search(a):
    a.error(501, "Not implemented")

# Settings (stub - to be implemented in Stage 5)
def action_settings(a):
    a.error(501, "Not implemented")

# Stub event handlers (to be implemented in later stages)

def event_page_create(e):
    pass

def event_page_update(e):
    pass

def event_page_delete(e):
    pass

def event_redirect_set(e):
    pass

def event_redirect_delete(e):
    pass

def event_tag_add(e):
    pass

def event_tag_remove(e):
    pass

def event_setting_set(e):
    pass
