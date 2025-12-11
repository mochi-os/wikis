# Mochi wiki app
# Copyright Alistair Cunningham 2025

# Database creation

def database_create():
    # Wikis table
    mochi.db.query("create table wikis (id text primary key, name text not null, home text not null default 'home', created integer not null)")

    # Pages table
    mochi.db.query("create table pages (id text primary key, wiki text not null references wikis(id), page text not null, title text not null, content text not null, author text not null, created integer not null, updated integer not null, version integer not null default 1, deleted integer not null default 0)")
    mochi.db.query("create unique index pages_wiki_page on pages(wiki, page)")
    mochi.db.query("create index pages_wiki on pages(wiki)")
    mochi.db.query("create index pages_updated on pages(updated)")
    mochi.db.query("create index pages_author on pages(author)")

    # Revisions table
    mochi.db.query("create table revisions (id text primary key, page text not null references pages(id), content text not null, title text not null, author text not null, created integer not null, version integer not null, comment text not null default '')")
    mochi.db.query("create index revisions_page on revisions(page)")
    mochi.db.query("create index revisions_created on revisions(created)")

    # Tags table
    mochi.db.query("create table tags (page text not null references pages(id), tag text not null, primary key (page, tag))")
    mochi.db.query("create index tags_tag on tags(tag)")

    # Redirects table
    mochi.db.query("create table redirects (wiki text not null references wikis(id), source text not null, target text not null, created integer not null, primary key (wiki, source))")

    # Subscribers table
    mochi.db.query("create table subscribers (wiki text not null references wikis(id), id text not null, name text not null default '', subscribed integer not null, primary key (wiki, id))")

# Helper: Get wiki from request, validating it exists
def get_wiki(a):
    wiki = a.input("wiki")
    mochi.log.debug("[WIKI] get_wiki: input wiki=%s", wiki)
    if not wiki:
        mochi.log.debug("[WIKI] get_wiki: wiki is empty/None")
        return None
    row = mochi.db.row("select * from wikis where id = ?", wiki)
    mochi.log.debug("[WIKI] get_wiki: db lookup result=%s", row)
    return row

# Helper: Broadcast event to all subscribers of a wiki
def broadcast_event(wiki, event, data):
    if not wiki:
        return
    subscribers = mochi.db.query("select id from subscribers where wiki = ?", wiki)
    for sub in subscribers:
        mochi.message.send(
            {"from": wiki, "to": sub["id"], "service": "wiki", "event": event},
            data
        )

# Helper: Get page by slug, following redirects
def get_page(wiki, slug):
    # Check for redirect first
    redirect = mochi.db.row("select target from redirects where wiki = ? and source = ?", wiki, slug)
    if redirect:
        slug = redirect["target"]

    page = mochi.db.row("select * from pages where wiki = ? and page = ? and deleted = 0", wiki, slug)
    return page

# Helper: Create a revision for a page
def create_revision(page, title, content, author, version, comment):
    id = mochi.uid()
    now = mochi.time.now()
    mochi.db.query("insert into revisions (id, page, content, title, author, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, ?)",
        id, page, content, title, author, now, version, comment)
    return id

# ACTIONS

# Create a new wiki entity
def action_create(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    name = a.input("name")
    if not name or not mochi.valid(name, "name"):
        a.error(400, "Invalid name")
        return

    privacy = a.input("privacy") or "public"
    if privacy not in ["public", "private"]:
        a.error(400, "Invalid privacy setting")
        return

    # Create entity for the wiki (returns entity ID string)
    entity = mochi.entity.create("wiki", name, privacy, "")
    if not entity:
        a.error(500, "Failed to create wiki entity")
        return

    # Register wiki in the database
    now = mochi.time.now()
    mochi.db.query("insert into wikis (id, name, created) values (?, ?, ?)", entity, name, now)

    return {"data": {"id": entity, "name": name}}

# Delete a wiki and all its data
def action_delete(a):
    if not a.user:
        a.error(401, "Authentication required")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    wiki_id = wiki["id"]

    # Delete all dependent data in order (respecting foreign keys)
    # 1. Delete tags (references pages)
    mochi.db.query("""
        delete from tags where page in (
            select id from pages where wiki = ?
        )
    """, wiki_id)

    # 2. Delete revisions (references pages)
    mochi.db.query("""
        delete from revisions where page in (
            select id from pages where wiki = ?
        )
    """, wiki_id)

    # 3. Delete pages
    mochi.db.query("delete from pages where wiki = ?", wiki_id)

    # 4. Delete redirects
    mochi.db.query("delete from redirects where wiki = ?", wiki_id)

    # 5. Delete subscribers
    mochi.db.query("delete from subscribers where wiki = ?", wiki_id)

    # 6. Delete wiki record
    mochi.db.query("delete from wikis where id = ?", wiki_id)

    # 7. Delete all attachments for this entity
    mochi.attachment.clear(wiki_id)

    # 8. Delete the entity from the entities table and directory
    mochi.entity.delete(wiki_id)

    return {"data": {"ok": True, "deleted": wiki_id}}

# Root action - redirect to home page or list wikis
def action_root(a):
    wiki = get_wiki(a)
    if not wiki:
        # No wiki specified - redirect to app page to list/create wikis
        a.redirect("app")
        return

    a.redirect(wiki["home"])

# Info endpoint for class context - returns list of wikis
def action_info_class(a):
    mochi.log.debug("[WIKI] action_info_class called")
    mochi.log.debug("[WIKI] action_info_class: a.user=%s", a.user)
    if not a.user:
        mochi.log.debug("[WIKI] action_info_class: returning 401 - not logged in")
        a.error(401, "Not logged in")
        return

    wikis = mochi.db.query("select id, name, home, created from wikis order by name")
    mochi.log.debug("[WIKI] action_info_class: found %s wikis", len(wikis))
    return {"data": {"entity": False, "wikis": wikis}}

# Info endpoint for entity context - returns wiki info
def action_info_entity(a):
    mochi.log.debug("[WIKI] action_info_entity called")
    mochi.log.debug("[WIKI] action_info_entity: a.user=%s", a.user)
    if not a.user:
        mochi.log.debug("[WIKI] action_info_entity: returning 401 - not logged in")
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    mochi.log.debug("[WIKI] action_info_entity: wiki=%s", wiki)
    if not wiki:
        mochi.log.debug("[WIKI] action_info_entity: returning 404 - wiki not found")
        a.error(404, "Wiki not found")
        return

    mochi.log.debug("[WIKI] action_info_entity: returning wiki info")
    return {"data": {"entity": True, "wiki": wiki}}

# View a page
def action_page(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    slug = a.input("page")
    if not slug:
        a.error(400, "Missing page parameter")
        return

    page = get_page(wiki["id"], slug)
    if not page:
        return {"data": {"error": "not_found", "page": slug}}

    # Get tags for this page
    tags = mochi.db.query("select tag from tags where page = ?", page["id"])
    taglist = [t["tag"] for t in tags]

    return {"data": {
        "page": {
            "id": page["id"],
            "slug": page["page"],
            "title": page["title"],
            "content": page["content"],
            "author": page["author"],
            "created": page["created"],
            "updated": page["updated"],
            "version": page["version"],
            "tags": taglist
        }
    }}

# Edit a page (create or update)
def action_page_edit(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
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
    existing = mochi.db.row("select * from pages where wiki = ? and page = ?", wiki["id"], slug)

    if existing:
        # Update existing page
        if existing["deleted"]:
            # Restore deleted page
            version = existing["version"] + 1
            mochi.db.query("update pages set title = ?, content = ?, author = ?, updated = ?, version = ?, deleted = 0 where id = ?",
                title, content, author, now, version, existing["id"])
            create_revision(existing["id"], title, content, author, version, comment)
            # Send page/create event (restored page)
            broadcast_event(wiki["id"], "page/create", {
                "id": existing["id"],
                "page": slug,
                "title": title,
                "content": content,
                "author": author,
                "created": now,
                "version": version
            })
            return {"data": {"id": existing["id"], "slug": slug, "version": version, "created": False}}
        else:
            # Update page
            version = existing["version"] + 1
            mochi.db.query("update pages set title = ?, content = ?, author = ?, updated = ?, version = ? where id = ?",
                title, content, author, now, version, existing["id"])
            create_revision(existing["id"], title, content, author, version, comment)
            # Send page/update event
            broadcast_event(wiki["id"], "page/update", {
                "id": existing["id"],
                "page": slug,
                "title": title,
                "content": content,
                "author": author,
                "updated": now,
                "version": version
            })
            return {"data": {"id": existing["id"], "slug": slug, "version": version, "created": False}}
    else:
        # Create new page
        id = mochi.uid()
        mochi.db.query("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, 1)",
            id, wiki["id"], slug, title, content, author, now, now)
        create_revision(id, title, content, author, 1, comment)
        # Send page/create event
        broadcast_event(wiki["id"], "page/create", {
            "id": id,
            "page": slug,
            "title": title,
            "content": content,
            "author": author,
            "created": now,
            "version": 1
        })
        return {"data": {"id": id, "slug": slug, "version": 1, "created": True}}

# Create a new page (returns page slug for redirect)
def action_new(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
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
    existing = mochi.db.row("select id from pages where wiki = ? and page = ?", wiki["id"], slug)
    if existing:
        a.error(409, "Page already exists")
        return

    # Create the page
    now = mochi.time.now()
    author = a.user.identity.id
    id = mochi.uid()

    mochi.db.query("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, 1)",
        id, wiki["id"], slug, title, content, author, now, now)
    create_revision(id, title, content, author, 1, "Initial creation")

    # Send page/create event
    broadcast_event(wiki["id"], "page/create", {
        "id": id,
        "page": slug,
        "title": title,
        "content": content,
        "author": author,
        "created": now,
        "version": 1
    })

    return {"data": {"id": id, "slug": slug}}

# Page history
def action_page_history(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    slug = a.input("page")
    if not slug:
        a.error(400, "Missing page parameter")
        return

    page = mochi.db.row("select * from pages where wiki = ? and page = ?", wiki["id"], slug)
    if not page:
        a.error(404, "Page not found")
        return

    revisions = mochi.db.query("select id, title, author, created, version, comment from revisions where page = ? order by version desc", page["id"])
    return {"data": {"page": slug, "revisions": revisions}}

# View a specific revision
def action_page_revision(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    slug = a.input("page")
    version = a.input("version")

    if not slug:
        a.error(400, "Missing page parameter")
        return

    if not version:
        a.error(400, "Missing version parameter")
        return

    page = mochi.db.row("select * from pages where wiki = ? and page = ?", wiki["id"], slug)
    if not page:
        a.error(404, "Page not found")
        return

    revision = mochi.db.row("select * from revisions where page = ? and version = ?", page["id"], int(version))
    if not revision:
        a.error(404, "Revision not found")
        return

    return {"data": {
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
    }}

# Revert to a previous revision
def action_page_revert(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
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

    page = mochi.db.row("select * from pages where wiki = ? and page = ?", wiki["id"], slug)
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
    newversion = page["version"] + 1

    if not comment:
        comment = "Reverted to version " + str(version)

    mochi.db.query("update pages set title = ?, content = ?, author = ?, updated = ?, version = ? where id = ?",
        revision["title"], revision["content"], author, now, newversion, page["id"])
    create_revision(page["id"], revision["title"], revision["content"], author, newversion, comment)

    # Send page/update event
    broadcast_event(wiki["id"], "page/update", {
        "id": page["id"],
        "page": slug,
        "title": revision["title"],
        "content": revision["content"],
        "author": author,
        "updated": now,
        "version": newversion
    })

    return {"data": {"slug": slug, "version": newversion, "reverted_from": int(version)}}

# Delete a page (soft delete)
def action_page_delete(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    slug = a.input("page")
    if not slug:
        a.error(400, "Missing page parameter")
        return

    page = mochi.db.row("select * from pages where wiki = ? and page = ? and deleted = 0", wiki["id"], slug)
    if not page:
        a.error(404, "Page not found")
        return

    now = mochi.time.now()
    version = page["version"] + 1

    mochi.db.query("update pages set deleted = ?, version = ? where id = ?", now, version, page["id"])

    # Send page/delete event
    broadcast_event(wiki["id"], "page/delete", {
        "id": page["id"],
        "deleted": now,
        "version": version
    })

    return {"data": {"ok": True, "slug": slug}}

# Add a tag to a page
def action_tag_add(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
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

    page = mochi.db.row("select id from pages where wiki = ? and page = ? and deleted = 0", wiki["id"], slug)
    if not page:
        a.error(404, "Page not found")
        return

    # Check if tag already exists
    existing = mochi.db.row("select 1 from tags where page = ? and tag = ?", page["id"], tag)
    if existing:
        return {"data": {"ok": True, "added": False}}

    mochi.db.query("insert into tags (page, tag) values (?, ?)", page["id"], tag)

    # Send tag/add event
    broadcast_event(wiki["id"], "tag/add", {
        "page": page["id"],
        "tag": tag
    })

    return {"data": {"ok": True, "added": True}}

# Remove a tag from a page
def action_tag_remove(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
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

    page = mochi.db.row("select id from pages where wiki = ? and page = ? and deleted = 0", wiki["id"], slug)
    if not page:
        a.error(404, "Page not found")
        return

    mochi.db.query("delete from tags where page = ? and tag = ?", page["id"], tag)

    # Send tag/remove event
    broadcast_event(wiki["id"], "tag/remove", {
        "page": page["id"],
        "tag": tag
    })

    return {"data": {"ok": True}}

# List all tags in the wiki
def action_tags(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    tags = mochi.db.query("""
        select t.tag, count(*) as count
        from tags t
        join pages p on p.id = t.page
        where p.wiki = ? and p.deleted = 0
        group by t.tag
        order by count desc, t.tag asc
    """, wiki["id"])
    return {"data": {"tags": tags}}

# List pages with a specific tag
def action_tag_pages(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    tag = a.input("tag")

    if not tag:
        a.error(400, "Missing tag parameter")
        return

    tag = tag.lower().strip()

    pages = mochi.db.query("""
        select p.page, p.title, p.updated
        from pages p
        join tags t on t.page = p.id
        where p.wiki = ? and t.tag = ? and p.deleted = 0
        order by p.updated desc
    """, wiki["id"], tag)

    return {"data": {"tag": tag, "pages": pages}}

# Create or update a redirect
def action_redirect_set(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
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
    targetpage = mochi.db.row("select id from pages where wiki = ? and page = ? and deleted = 0", wiki["id"], target)
    if not targetpage:
        a.error(400, "Target page does not exist")
        return

    # Check if source conflicts with an existing page
    sourcepage = mochi.db.row("select id from pages where wiki = ? and page = ? and deleted = 0", wiki["id"], source)
    if sourcepage:
        a.error(400, "Cannot redirect: a page with this slug already exists")
        return

    now = mochi.time.now()
    mochi.db.query("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki["id"], source, target, now)

    # Send redirect/set event
    broadcast_event(wiki["id"], "redirect/set", {
        "source": source,
        "target": target,
        "created": now
    })

    return {"data": {"ok": True}}

# Delete a redirect
def action_redirect_delete(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    source = a.input("source")

    if not source:
        a.error(400, "Source is required")
        return

    source = source.lower().strip()
    mochi.db.query("delete from redirects where wiki = ? and source = ?", wiki["id"], source)

    # Send redirect/delete event
    broadcast_event(wiki["id"], "redirect/delete", {
        "source": source
    })

    return {"data": {"ok": True}}

# List all redirects
def action_redirects(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    redirects = mochi.db.query("select source, target, created from redirects where wiki = ? order by source", wiki["id"])
    return {"data": {"redirects": redirects}}

# View wiki settings
def action_settings(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    return {"data": {"settings": {"home": wiki["home"]}}}

# Update a wiki setting
def action_settings_set(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
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
    if name == "home":
        mochi.db.query("update wikis set home = ? where id = ?", value, wiki["id"])
    else:
        a.error(400, "Unknown setting: " + name)
        return

    # Send setting/set event
    broadcast_event(wiki["id"], "setting/set", {
        "name": name,
        "value": value
    })

    return {"data": {"ok": True}}

# Search pages by title and content
def action_search(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    query = a.input("q", "")

    if not query or len(query.strip()) == 0:
        return {"data": {"query": "", "results": []}}

    query = query.strip()

    # Use LIKE for simple search (SQLite FTS could be added later for better performance)
    pattern = "%" + query + "%"

    results = mochi.db.query("""
        select page, title, substr(content, 1, 200) as excerpt, updated
        from pages
        where wiki = ? and deleted = 0 and (title like ? or content like ?)
        order by
            case when title like ? then 0 else 1 end,
            updated desc
        limit 50
    """, wiki["id"], pattern, pattern, pattern)

    return {"data": {"query": query, "results": results}}

# EVENT HANDLERS

# Helper: Check if incoming page update should be applied (conflict resolution)
# Returns True if incoming update wins, False if local version should be kept
def should_apply_update(local, version, updated, author):
    if not local:
        return True
    if version > local["version"]:
        return True
    if version < local["version"]:
        return False
    # Same version: higher timestamp wins
    if updated > local["updated"]:
        return True
    if updated < local["updated"]:
        return False
    # Same version + same timestamp: lower author ID wins (older entity)
    return author < local["author"]

# Receive page/create event
def event_page_create(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Ensure wiki exists in database
    if not mochi.db.exists("select 1 from wikis where id = ?", wiki):
        return

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
        mochi.db.query("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id, wiki, page, title, content, author, created, created, version)

    # Create revision record
    revid = mochi.uid()
    mochi.db.query("insert or ignore into revisions (id, page, content, title, author, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, '')",
        revid, id, content, title, author, created, version)

# Receive page/update event
def event_page_update(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Ensure wiki exists in database
    if not mochi.db.exists("select 1 from wikis where id = ?", wiki):
        return

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
        mochi.db.query("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id, wiki, page, title, content, author, updated, updated, version)
    else:
        # Apply conflict resolution
        if not should_apply_update(existing, version, updated, author):
            return

        # Update page
        mochi.db.query("update pages set page = ?, title = ?, content = ?, author = ?, updated = ?, version = ? where id = ?",
            page, title, content, author, updated, version, id)

    # Create revision record
    revid = mochi.uid()
    mochi.db.query("insert or ignore into revisions (id, page, content, title, author, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, '')",
        revid, id, content, title, author, updated, version)

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
    wiki = e.header("to")
    if not wiki:
        return

    source = e.content("source")
    target = e.content("target")
    created = e.content("created")

    # Validate required fields
    if not source or not target or not created:
        return

    # Insert or update redirect
    mochi.db.query("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki, source, target, created)

# Receive redirect/delete event
def event_redirect_delete(e):
    wiki = e.header("to")
    if not wiki:
        return

    source = e.content("source")

    # Validate required fields
    if not source:
        return

    mochi.db.query("delete from redirects where wiki = ? and source = ?", wiki, source)

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
    wiki = e.header("to")
    if not wiki:
        return

    name = e.content("name")
    value = e.content("value")

    # Validate required fields
    if not name or value == None:
        return

    # Only allow known settings
    if name == "home":
        mochi.db.query("update wikis set home = ? where id = ?", value, wiki)

# SUBSCRIPTION

# Handle subscription request - add requester to subscribers list
def event_subscribe(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Get the subscriber's entity ID from message header
    subscriber = e.header("from")
    if not subscriber:
        return

    # Get optional name from content
    name = e.content("name") or ""

    now = mochi.time.now()

    # Add or update subscriber
    mochi.db.query("replace into subscribers (wiki, id, name, subscribed) values (?, ?, ?, ?)",
        wiki, subscriber, name, now)

# INITIAL SYNC

# Handle sync request - send full wiki dump to requester
def event_sync(e):
    wiki = e.header("to")
    if not wiki:
        e.write({"status": "400", "error": "Missing wiki ID"})
        return

    # Verify wiki exists
    if not mochi.db.exists("select 1 from wikis where id = ?", wiki):
        e.write({"status": "404", "error": "Wiki not found"})
        return

    # Generate full dump of all wiki data
    pages = mochi.db.query("select * from pages where wiki = ?", wiki)
    pageids = [p["id"] for p in pages]

    revisions = []
    tags = []
    if pageids:
        # Get revisions and tags for all pages in this wiki
        for pageid in pageids:
            pagerevisions = mochi.db.query("select * from revisions where page = ?", pageid)
            revisions.extend(pagerevisions)
            pagetags = mochi.db.query("select * from tags where page = ?", pageid)
            tags.extend(pagetags)

    redirects = mochi.db.query("select * from redirects where wiki = ?", wiki)
    wikirow = mochi.db.row("select home from wikis where id = ?", wiki)

    # Send dump as a single payload
    e.write({
        "status": "200",
        "pages": pages,
        "revisions": revisions,
        "tags": tags,
        "redirects": redirects,
        "home": wikirow["home"] if wikirow else "home"
    })

# Helper: Import wiki dump from sync response
def import_sync_dump(wiki, dump):
    if not dump or dump.get("status") != "200":
        return False

    # Import pages
    pages = dump.get("pages", [])
    for p in pages:
        existing = mochi.db.row("select version from pages where id = ?", p["id"])
        if existing and existing["version"] >= p["version"]:
            continue
        mochi.db.query("replace into pages (id, wiki, page, title, content, author, created, updated, version, deleted) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            p["id"], wiki, p["page"], p["title"], p["content"], p["author"], p["created"], p["updated"], p["version"], p.get("deleted", 0))

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
        mochi.db.query("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki, r["source"], r["target"], r["created"])

    # Import home setting
    home = dump.get("home")
    if home:
        mochi.db.query("update wikis set home = ? where id = ?", home, wiki)

    return True

# Subscribe to a wiki - request to be added to their subscribers list
def action_subscribe(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    # Get target wiki entity to subscribe to
    target = a.input("target")
    if not target:
        a.error(400, "Target wiki entity is required")
        return

    # Send subscribe request to target
    mochi.message.send(
        {"from": wiki["id"], "to": target, "service": "wiki", "event": "subscribe"},
        {"name": a.user.identity.name or ""}
    )

    return {"data": {"ok": True, "message": "Subscription request sent"}}

# Request sync from another wiki participant
def action_sync(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    # Get target wiki entity to sync from
    target = a.input("target")
    if not target:
        a.error(400, "Target wiki entity is required")
        return

    # Open stream to target and request sync
    stream = mochi.stream(
        {"from": wiki["id"], "to": target, "service": "wiki", "event": "sync"},
        {}
    )

    # Read the response
    dump = stream.read()
    if not dump:
        a.error(500, "Failed to receive sync data")
        return

    # Import the dump
    if import_sync_dump(wiki["id"], dump):
        return {"data": {"ok": True, "message": "Sync completed successfully"}}
    else:
        a.error(500, "Failed to import sync data")

# ATTACHMENTS

# List all wiki attachments
def action_attachments(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    attachments = mochi.attachment.list(wiki["id"])
    return {"data": {"attachments": attachments or []}}

# Upload an attachment
def action_attachment_upload(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    # Get subscribers for notification
    subscribers = mochi.db.query("select id from subscribers where wiki = ? and id != ?", wiki["id"], wiki["id"])

    # Save uploaded attachments and notify subscribers
    attachments = mochi.attachment.save(wiki["id"], "files", [], [], subscribers)

    if not attachments:
        a.error(400, "No files uploaded")
        return

    return {"data": {"attachments": attachments}}

# Delete an attachment
def action_attachment_delete(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    id = a.input("id")
    if not id:
        a.error(400, "Attachment ID is required")
        return

    if mochi.attachment.delete(id):
        return {"data": {"ok": True}}
    else:
        a.error(404, "Attachment not found")
