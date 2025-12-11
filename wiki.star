# Mochi wiki app
# Copyright Alistair Cunningham 2025

# Database creation

def database_create(db):
    db.exec("create table pages (id text primary key, page text not null unique, title text not null, content text not null, author text not null, created integer not null, updated integer not null, version integer not null default 1, deleted integer not null default 0)")
    db.exec("create table revisions (id text primary key, page text not null references pages(id), content text not null, title text not null, author text not null, created integer not null, version integer not null, comment text not null default '')")
    db.exec("create table tags (page text not null references pages(id), tag text not null, primary key (page, tag))")
    db.exec("create table redirects (source text primary key, target text not null, created integer not null)")
    db.exec("create table settings (name text primary key, value text not null)")
    db.exec("create table subscribers (id text primary key, name text not null default '', subscribed integer not null)")
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

# Helper: Broadcast event to all subscribers
def broadcast_event(a, event, data):
    wiki_entity = a.input("wiki")
    if not wiki_entity:
        return
    subscribers = mochi.db.query("select id from subscribers")
    for sub in subscribers:
        mochi.message.send(
            {"from": wiki_entity, "to": sub["id"], "service": "wiki", "event": event},
            data
        )

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

# Root action - redirect to home page
def action_root(a):
    home = get_setting("home", "home")
    a.redirect(home)

# View a page
def action_page(a):
    slug = a.input("page")
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

    slug = a.input("page")
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
            # Send page/create event (restored page)
            broadcast_event(a, "page/create", {
                "id": existing["id"],
                "page": slug,
                "title": title,
                "content": content,
                "author": author,
                "created": now,
                "version": new_version
            })
            a.json({"id": existing["id"], "slug": slug, "version": new_version, "created": False})
        else:
            # Update page
            new_version = existing["version"] + 1
            mochi.db.query("update pages set title = ?, content = ?, author = ?, updated = ?, version = ? where id = ?",
                title, content, author, now, new_version, existing["id"])
            create_revision(existing["id"], title, content, author, new_version, comment)
            # Send page/update event
            broadcast_event(a, "page/update", {
                "id": existing["id"],
                "page": slug,
                "title": title,
                "content": content,
                "author": author,
                "updated": now,
                "version": new_version
            })
            a.json({"id": existing["id"], "slug": slug, "version": new_version, "created": False})
    else:
        # Create new page
        page_id = mochi.uid()
        mochi.db.query("insert into pages (id, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, 1)",
            page_id, slug, title, content, author, now, now)
        create_revision(page_id, title, content, author, 1, comment)
        # Send page/create event
        broadcast_event(a, "page/create", {
            "id": page_id,
            "page": slug,
            "title": title,
            "content": content,
            "author": author,
            "created": now,
            "version": 1
        })
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

    # Send page/create event
    broadcast_event(a, "page/create", {
        "id": page_id,
        "page": slug,
        "title": title,
        "content": content,
        "author": author,
        "created": now,
        "version": 1
    })

    a.json({"id": page_id, "slug": slug})

# Page history (stub - to be implemented in Stage 3)
def action_page_history(a):
    slug = a.input("page")
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
    slug = a.input("page")
    version = a.input("version")

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

    slug = a.input("page")
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

    # Send page/update event
    broadcast_event(a, "page/update", {
        "id": page["id"],
        "page": slug,
        "title": revision["title"],
        "content": revision["content"],
        "author": author,
        "updated": now,
        "version": new_version
    })

    a.json({"slug": slug, "version": new_version, "reverted_from": int(version)})

# Delete a page (soft delete)
def action_page_delete(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    slug = a.input("page")
    if not slug:
        a.error(400, "Missing page parameter")
        return

    page = mochi.db.row("select * from pages where page = ? and deleted = 0", slug)
    if not page:
        a.error(404, "Page not found")
        return

    now = mochi.time.now()
    new_version = page["version"] + 1

    mochi.db.query("update pages set deleted = ?, version = ? where id = ?", now, new_version, page["id"])

    # Send page/delete event
    broadcast_event(a, "page/delete", {
        "id": page["id"],
        "deleted": now,
        "version": new_version
    })

    a.json({"ok": True, "slug": slug})

# Add a tag to a page
def action_tag_add(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    slug = a.input("page")
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

    # Send tag/add event
    broadcast_event(a, "tag/add", {
        "page": page["id"],
        "tag": tag
    })

    a.json({"ok": True, "added": True})

# Remove a tag from a page
def action_tag_remove(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    slug = a.input("page")
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

    # Send tag/remove event
    broadcast_event(a, "tag/remove", {
        "page": page["id"],
        "tag": tag
    })

    a.json({"ok": True})

# List all tags in the wiki
def action_tags(a):
    tags = mochi.db.query("select tag, count(*) as count from tags group by tag order by count desc, tag asc")
    a.json({"tags": tags})

# List pages with a specific tag
def action_tag_pages(a):
    tag = a.input("tag")

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

# Create or update a redirect
def action_redirect_set(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    source = a.input("source")
    target = a.input("target")

    if not source:
        a.error(400, "Source is required")
        return

    if not target:
        a.error(400, "Target is required")
        return

    # Normalize slugs
    source = source.lower().strip()
    target = target.lower().strip()

    if source == target:
        a.error(400, "Source and target cannot be the same")
        return

    # Check if source is a reserved path
    if source.startswith("-"):
        a.error(400, "Cannot redirect reserved paths")
        return

    # Check if target page exists
    target_page = mochi.db.row("select id from pages where page = ? and deleted = 0", target)
    if not target_page:
        a.error(400, "Target page does not exist")
        return

    # Check if source conflicts with an existing page
    source_page = mochi.db.row("select id from pages where page = ? and deleted = 0", source)
    if source_page:
        a.error(400, "Cannot redirect: a page with this slug already exists")
        return

    now = mochi.time.now()
    mochi.db.query("replace into redirects (source, target, created) values (?, ?, ?)", source, target, now)

    # Send redirect/set event
    broadcast_event(a, "redirect/set", {
        "source": source,
        "target": target,
        "created": now
    })

    a.json({"ok": True})

# Delete a redirect
def action_redirect_delete(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    source = a.input("source")

    if not source:
        a.error(400, "Source is required")
        return

    source = source.lower().strip()
    mochi.db.query("delete from redirects where source = ?", source)

    # Send redirect/delete event
    broadcast_event(a, "redirect/delete", {
        "source": source
    })

    a.json({"ok": True})

# List all redirects
def action_redirects(a):
    redirects = mochi.db.query("select source, target, created from redirects order by source")
    a.json({"redirects": redirects})

# View wiki settings
def action_settings(a):
    rows = mochi.db.query("select name, value from settings")
    settings = {}
    for row in rows:
        settings[row["name"]] = row["value"]
    a.json({"settings": settings})

# Update a wiki setting
def action_settings_set(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    name = a.input("name")
    value = a.input("value")

    if not name:
        a.error(400, "Setting name is required")
        return

    if value == None:
        a.error(400, "Setting value is required")
        return

    # Only allow known settings
    known_settings = ["home"]
    if name not in known_settings:
        a.error(400, "Unknown setting: " + name)
        return

    mochi.db.query("replace into settings (name, value) values (?, ?)", name, value)

    # Send setting/set event
    broadcast_event(a, "setting/set", {
        "name": name,
        "value": value
    })

    a.json({"ok": True})

# Search pages by title and content
def action_search(a):
    query = a.input("q", "")

    if not query or len(query.strip()) == 0:
        a.json({"query": "", "results": []})
        return

    query = query.strip()

    # Use LIKE for simple search (SQLite FTS could be added later for better performance)
    search_pattern = "%" + query + "%"

    results = mochi.db.query("""
        select page, title, substr(content, 1, 200) as excerpt, updated
        from pages
        where deleted = 0 and (title like ? or content like ?)
        order by
            case when title like ? then 0 else 1 end,
            updated desc
        limit 50
    """, search_pattern, search_pattern, search_pattern)

    a.json({"query": query, "results": results})

# EVENT HANDLERS

# Helper: Check if incoming page update should be applied (conflict resolution)
# Returns True if incoming update wins, False if local version should be kept
def should_apply_update(local, incoming_version, incoming_updated, incoming_author):
    if not local:
        return True
    local_version = local["version"]
    if incoming_version > local_version:
        return True
    if incoming_version < local_version:
        return False
    # Same version: higher timestamp wins
    local_updated = local["updated"]
    if incoming_updated > local_updated:
        return True
    if incoming_updated < local_updated:
        return False
    # Same version + same timestamp: lower author ID wins (older entity)
    return incoming_author < local["author"]

# Receive page/create event
def event_page_create(e):
    id = e.content("id")
    page = e.content("page")
    title = e.content("title")
    content = e.content("content")
    author = e.content("author")
    created = e.content("created")
    version = e.content("version")

    # Validate required fields
    if not id or not page or not title or not author or not created or not version:
        return

    # Check if page already exists
    existing = mochi.db.row("select * from pages where id = ?", id)

    if existing:
        # Apply conflict resolution
        if not should_apply_update(existing, version, created, author):
            return

        # Update existing page (may be restoring a deleted page)
        mochi.db.query("update pages set page = ?, title = ?, content = ?, author = ?, created = ?, updated = ?, version = ?, deleted = 0 where id = ?",
            page, title, content, author, created, created, version, id)
    else:
        # Insert new page
        mochi.db.query("insert into pages (id, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?)",
            id, page, title, content, author, created, created, version)

    # Create revision record
    revision_id = mochi.uid()
    mochi.db.query("insert or ignore into revisions (id, page, content, title, author, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, '')",
        revision_id, id, content, title, author, created, version)

# Receive page/update event
def event_page_update(e):
    id = e.content("id")
    page = e.content("page")
    title = e.content("title")
    content = e.content("content")
    author = e.content("author")
    updated = e.content("updated")
    version = e.content("version")

    # Validate required fields
    if not id or not page or not title or not author or not updated or not version:
        return

    # Check if page exists
    existing = mochi.db.row("select * from pages where id = ?", id)

    if not existing:
        # Page doesn't exist locally - create it
        mochi.db.query("insert into pages (id, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?)",
            id, page, title, content, author, updated, updated, version)
    else:
        # Apply conflict resolution
        if not should_apply_update(existing, version, updated, author):
            return

        # Update page
        mochi.db.query("update pages set page = ?, title = ?, content = ?, author = ?, updated = ?, version = ? where id = ?",
            page, title, content, author, updated, version, id)

    # Create revision record
    revision_id = mochi.uid()
    mochi.db.query("insert or ignore into revisions (id, page, content, title, author, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, '')",
        revision_id, id, content, title, author, updated, version)

# Receive page/delete event
def event_page_delete(e):
    id = e.content("id")
    deleted = e.content("deleted")
    version = e.content("version")

    # Validate required fields
    if not id or not deleted or not version:
        return

    # Check if page exists
    existing = mochi.db.row("select * from pages where id = ?", id)
    if not existing:
        return

    # Only delete if incoming version is higher
    if version <= existing["version"]:
        return

    # Soft delete
    mochi.db.query("update pages set deleted = ?, version = ? where id = ?", deleted, version, id)

# Receive redirect/set event
def event_redirect_set(e):
    source = e.content("source")
    target = e.content("target")
    created = e.content("created")

    # Validate required fields
    if not source or not target or not created:
        return

    # Insert or update redirect
    mochi.db.query("replace into redirects (source, target, created) values (?, ?, ?)", source, target, created)

# Receive redirect/delete event
def event_redirect_delete(e):
    source = e.content("source")

    # Validate required fields
    if not source:
        return

    mochi.db.query("delete from redirects where source = ?", source)

# Receive tag/add event
def event_tag_add(e):
    page = e.content("page")
    tag = e.content("tag")

    # Validate required fields
    if not page or not tag:
        return

    # Check if page exists
    if not mochi.db.exists("select 1 from pages where id = ?", page):
        return

    # Insert tag (ignore if already exists)
    mochi.db.query("insert or ignore into tags (page, tag) values (?, ?)", page, tag)

# Receive tag/remove event
def event_tag_remove(e):
    page = e.content("page")
    tag = e.content("tag")

    # Validate required fields
    if not page or not tag:
        return

    mochi.db.query("delete from tags where page = ? and tag = ?", page, tag)

# Receive setting/set event
def event_setting_set(e):
    name = e.content("name")
    value = e.content("value")

    # Validate required fields
    if not name or value == None:
        return

    # Only allow known settings
    known_settings = ["home"]
    if name not in known_settings:
        return

    mochi.db.query("replace into settings (name, value) values (?, ?)", name, value)

# INITIAL SYNC

# Handle sync request - send full wiki dump to requester
def event_sync(e):
    # Generate full dump of all wiki data
    pages = mochi.db.query("select * from pages")
    revisions = mochi.db.query("select * from revisions")
    tags = mochi.db.query("select * from tags")
    redirects = mochi.db.query("select * from redirects")
    settings = mochi.db.query("select * from settings")

    # Send dump as a single payload
    e.write({
        "status": "200",
        "pages": pages,
        "revisions": revisions,
        "tags": tags,
        "redirects": redirects,
        "settings": settings
    })

# Helper: Import wiki dump from sync response
def import_sync_dump(dump):
    if not dump or dump.get("status") != "200":
        return False

    # Import pages
    pages = dump.get("pages", [])
    for p in pages:
        existing = mochi.db.row("select version from pages where id = ?", p["id"])
        if existing and existing["version"] >= p["version"]:
            continue
        mochi.db.query("replace into pages (id, page, title, content, author, created, updated, version, deleted) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            p["id"], p["page"], p["title"], p["content"], p["author"], p["created"], p["updated"], p["version"], p.get("deleted", 0))

    # Import revisions
    revisions = dump.get("revisions", [])
    for r in revisions:
        mochi.db.query("insert or ignore into revisions (id, page, content, title, author, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, ?)",
            r["id"], r["page"], r["content"], r["title"], r["author"], r["created"], r["version"], r.get("comment", ""))

    # Import tags
    tags = dump.get("tags", [])
    for t in tags:
        mochi.db.query("insert or ignore into tags (page, tag) values (?, ?)", t["page"], t["tag"])

    # Import redirects
    redirects = dump.get("redirects", [])
    for r in redirects:
        mochi.db.query("replace into redirects (source, target, created) values (?, ?, ?)", r["source"], r["target"], r["created"])

    # Import settings
    settings = dump.get("settings", [])
    for s in settings:
        mochi.db.query("replace into settings (name, value) values (?, ?)", s["name"], s["value"])

    return True

# Request sync from another wiki participant
def action_sync(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    # Get target wiki entity to sync from
    target = a.input("target")
    if not target:
        a.error(400, "Target wiki entity is required")
        return

    # Get our wiki entity
    wiki_entity = a.input("wiki")
    if not wiki_entity:
        a.error(400, "Wiki entity not found")
        return

    # Open stream to target and request sync
    stream = mochi.stream(
        {"from": wiki_entity, "to": target, "service": "wiki", "event": "sync"},
        {}
    )

    # Read the response
    dump = stream.read()
    if not dump:
        a.error(500, "Failed to receive sync data")
        return

    # Import the dump
    if import_sync_dump(dump):
        a.json({"ok": True, "message": "Sync completed successfully"})
    else:
        a.error(500, "Failed to import sync data")
