# Mochi wiki app
# Copyright Alistair Cunningham 2025

# Database creation

def database_create():
    # Wikis table - source is the upstream wiki entity ID for joined wikis
    mochi.db.execute("create table if not exists wikis (id text primary key, name text not null, home text not null default 'home', source text not null default '', created integer not null)")

    # Pages table
    mochi.db.execute("create table if not exists pages (id text primary key, wiki text not null references wikis(id), page text not null, title text not null, content text not null, author text not null, created integer not null, updated integer not null, version integer not null default 1, deleted integer not null default 0)")
    mochi.db.execute("create unique index if not exists pages_wiki_page on pages(wiki, page)")
    mochi.db.execute("create index if not exists pages_wiki on pages(wiki)")
    mochi.db.execute("create index if not exists pages_updated on pages(updated)")
    mochi.db.execute("create index if not exists pages_author on pages(author)")

    # Revisions table
    mochi.db.execute("create table if not exists revisions (id text primary key, page text not null references pages(id), content text not null, title text not null, author text not null, name text not null default '', created integer not null, version integer not null, comment text not null default '')")
    mochi.db.execute("create index if not exists revisions_page on revisions(page)")
    mochi.db.execute("create index if not exists revisions_created on revisions(created)")

    # Tags table
    mochi.db.execute("create table if not exists tags (page text not null references pages(id), tag text not null, primary key (page, tag))")
    mochi.db.execute("create index if not exists tags_tag on tags(tag)")

    # Redirects table
    mochi.db.execute("create table if not exists redirects (wiki text not null references wikis(id), source text not null, target text not null, created integer not null, primary key (wiki, source))")

    # Subscribers table
    mochi.db.execute("create table if not exists subscribers (wiki text not null references wikis(id), id text not null, name text not null default '', subscribed integer not null, seen integer not null default 0, primary key (wiki, id))")

    # Bookmarks table - for following external wikis without making a local copy
    mochi.db.execute("create table if not exists bookmarks (id text primary key, name text not null, added integer not null)")
    mochi.db.execute("create index if not exists bookmarks_added on bookmarks(added)")

# Helper: Update subscriber's seen timestamp
def update_subscriber_seen(wiki, subscriber_id):
    now = mochi.time.now()
    mochi.db.execute("update subscribers set seen=? where wiki=? and id=?", now, wiki, subscriber_id)

# Helper: Get wiki from request, validating it exists
def get_wiki(a):
    wiki = a.input("wiki")
    if not wiki:
        return None
    return mochi.db.row("select * from wikis where id=?", wiki)

# Access level hierarchy: edit > view
# Each level grants access to that operation and all operations below it.
# "edit" includes delete capability.
# "none" explicitly blocks all access (stored as deny rules for all levels).
# "manage" is separate and grants all permissions (typically owner-only).
ACCESS_LEVELS = ["view", "edit"]

# Helper: Check if current user has access to perform an operation
# Uses hierarchical access levels: edit grants view, view is base level.
# Users with "manage" or "*" permission automatically have all permissions.
# The "delete" operation is treated as "edit" (edit includes delete).
def check_access(a, wiki_id, operation, page=None):
    resource = "wiki/" + wiki_id
    user = None
    if a.user and a.user.identity:
        user = a.user.identity.id

    # Owner has full access (mochi.entity.get returns entity only if current user owns it)
    if mochi.entity.get(wiki_id):
        return True

    # Manage or wildcard grants full access
    if mochi.access.check(user, resource, "manage") or mochi.access.check(user, resource, "*"):
        return True

    # Map "delete" to "edit" (edit includes delete capability)
    if operation == "delete":
        operation = "edit"

    # For hierarchical levels, check if user has the required level or higher
    # ACCESS_LEVELS is ordered lowest to highest: ["view", "edit"]
    if operation in ACCESS_LEVELS:
        op_index = ACCESS_LEVELS.index(operation)
        for level in ACCESS_LEVELS[op_index:]:
            if mochi.access.check(user, resource, level):
                return True

    return False

# Helper: Check if remote user (from event header) has access to perform an operation
# Uses same hierarchical levels as check_access.
def check_event_access(user_id, wiki_id, operation, page=None):
    resource = "wiki/" + wiki_id

    # Owner has full access - check if requester owns the wiki entity
    entity = mochi.entity.info(wiki_id)
    mochi.log.debug("check_event_access: user_id=%s wiki_id=%s entity=%s", user_id, wiki_id, entity)
    if entity and entity.get("creator") == user_id:
        mochi.log.debug("check_event_access: user is owner, granting access")
        return True

    # Manage or wildcard grants full access
    if mochi.access.check(user_id, resource, "manage") or mochi.access.check(user_id, resource, "*"):
        mochi.log.debug("check_event_access: user has manage/* access")
        return True

    # Map "delete" to "edit" (edit includes delete capability)
    if operation == "delete":
        operation = "edit"

    # For hierarchical levels, check if user has the required level or higher
    if operation in ACCESS_LEVELS:
        op_index = ACCESS_LEVELS.index(operation)
        for level in ACCESS_LEVELS[op_index:]:
            result = mochi.access.check(user_id, resource, level)
            mochi.log.debug("check_event_access: access.check(%s, %s, %s) = %s", user_id, resource, level, result)
            if result:
                return True

    mochi.log.debug("check_event_access: access denied for user=%s resource=%s operation=%s", user_id, resource, operation)
    return False

# Helper: Validate that event sender is authorized to push updates
# Returns True if valid, False otherwise. Updates subscriber seen timestamp if valid.
def validate_event_sender(wikirow, wiki, sender):
    source = wikirow.get("source")
    if source:
        # Subscriber wiki: only accept from our source
        return sender == source
    # Source wiki: only accept from registered subscribers
    if not mochi.db.exists("select 1 from subscribers where wiki=? and id=?", wiki, sender):
        return False
    update_subscriber_seen(wiki, sender)
    return True

# Helper: Broadcast event to all subscribers of a wiki
def broadcast_event(wiki, event, data, exclude=None):
    if not wiki:
        return
    subscribers = mochi.db.rows("select id from subscribers where wiki=?", wiki)
    for sub in subscribers:
        if exclude and sub["id"] == exclude:
            continue
        mochi.message.send(
            {"from": wiki, "to": sub["id"], "service": "wikis", "event": event},
            data
        )

# Helper: Remove attachment references from content
def remove_attachment_refs(content, attachment_id):
    ref = "attachments/" + attachment_id
    if ref not in content:
        return content

    result = []
    for line in content.split("\n"):
        if ref not in line:
            result.append(line)
            continue

        # Process line to remove attachment references
        new_line = ""
        i = 0
        while i < len(line):
            # Check for markdown image: ![alt](url)
            if i < len(line) - 1 and line[i:i+2] == "![":
                close_bracket = line.find("](", i)
                if close_bracket != -1:
                    close_paren = line.find(")", close_bracket)
                    if close_paren != -1:
                        url = line[close_bracket+2:close_paren]
                        if ref in url:
                            # Skip this image reference
                            i = close_paren + 1
                            continue
                new_line += line[i]
                i += 1
            # Check for markdown link: [text](url)
            elif line[i] == "[" and (i == 0 or line[i-1] != "!"):
                close_bracket = line.find("](", i)
                if close_bracket != -1:
                    close_paren = line.find(")", close_bracket)
                    if close_paren != -1:
                        url = line[close_bracket+2:close_paren]
                        if ref in url:
                            # Skip this link reference
                            i = close_paren + 1
                            continue
                new_line += line[i]
                i += 1
            else:
                new_line += line[i]
                i += 1

        # Only keep line if it has content after removing references
        if new_line.strip():
            result.append(new_line)

    return "\n".join(result)

# Helper: Fetch wiki info from a remote wiki via P2P stream
def fetch_remote_wiki_info(a, wiki_id):
    dump = mochi.remote.request(wiki_id, "wikis", "sync", {})
    if dump.get("error"):
        return {"error": "offline"}

    status = dump.get("status")
    if not status:
        return {"error": "offline"}
    if status == "400":
        return {"error": dump.get("error", "bad_request")}
    if status == "403":
        return {"error": "access_denied"}
    if status == "404":
        return {"error": "not_found"}
    if status != "200":
        return {"error": dump.get("error", "unknown")}

    permissions = dump.get("permissions") or {}
    return {
        "name": dump.get("name"),
        "home": dump.get("home"),
        "permissions": {
            "view": permissions.get("view", True),
            "edit": permissions.get("edit", False),
        },
    }

# Helper: Fetch a page from a remote wiki via P2P stream
def fetch_remote_page(a, wiki_id, slug):
    dump = mochi.remote.request(wiki_id, "wikis", "sync", {})
    if dump.get("error"):
        return {"error": "offline"}

    status = dump.get("status")
    if not status:
        return {"error": "offline"}
    if status == "400":
        return {"error": dump.get("error", "bad_request")}
    if status == "403":
        return {"error": "access_denied"}
    if status == "404":
        return {"error": "not_found"}
    if status != "200":
        return {"error": dump.get("error", "unknown")}

    # Look for the page in the dump
    pages = dump.get("pages") or []

    # First check for redirects
    redirects = dump.get("redirects") or []
    for r in redirects:
        if r.get("source") == slug:
            slug = r.get("target")
            break

    # Find the page
    for p in pages:
        if p.get("page") == slug and not p.get("deleted"):
            # Get tags for this page from the dump
            tags = []
            page_id = p.get("id")
            for t in (dump.get("tags") or []):
                if t.get("page") == page_id:
                    tags.append(t.get("tag"))

            return {
                "id": p.get("id"),
                "slug": p.get("page"),
                "title": p.get("title"),
                "content": p.get("content"),
                "author": p.get("author"),
                "created": p.get("created"),
                "updated": p.get("updated"),
                "version": p.get("version"),
                "tags": tags
            }

    return None

# Helper: Fetch page history from a remote wiki via P2P stream
def fetch_remote_page_history(a, wiki_id, slug):
    dump = mochi.remote.request(wiki_id, "wikis", "sync", {})
    if dump.get("error"):
        return {"error": "offline"}

    status = dump.get("status")
    if not status:
        return {"error": "offline"}
    if status == "400":
        return {"error": dump.get("error", "bad_request")}
    if status == "403":
        return {"error": "access_denied"}
    if status == "404":
        return {"error": "not_found"}
    if status != "200":
        return {"error": dump.get("error", "unknown")}

    # First check for redirects
    redirects = dump.get("redirects") or []
    for r in redirects:
        if r.get("source") == slug:
            slug = r.get("target")
            break

    # Find the page
    pages = dump.get("pages") or []
    page = None
    for p in pages:
        if p.get("page") == slug:
            page = p
            break

    if not page:
        return None

    # Get revisions for this page
    page_id = page.get("id")
    revisions = []
    for r in (dump.get("revisions") or []):
        if r.get("page") == page_id:
            rev = {
                "id": r.get("id"),
                "title": r.get("title"),
                "author": r.get("author"),
                "name": r.get("name", ""),
                "created": r.get("created"),
                "version": r.get("version"),
                "comment": r.get("comment", "")
            }
            # Resolve author name if not stored
            if not rev["name"]:
                name = mochi.entity.name(rev["author"])
                if name:
                    rev["name"] = name
                else:
                    rev["name"] = rev["author"][:12] + "..."
            revisions.append(rev)

    # Sort by version descending
    revisions = sorted(revisions, key=lambda x: x.get("version", 0), reverse=True)

    return {"page": slug, "revisions": revisions}

# Helper: Send a page edit request to a remote wiki via P2P stream
def send_remote_page_edit(a, wiki_id):
    slug = a.input("page")
    title = a.input("title")
    content = a.input("content")
    comment = a.input("comment", "")

    if not slug:
        return {"error": "Missing page parameter"}
    if not title:
        return {"error": "Title is required"}

    from_entity = a.user.identity.id if a.user and a.user.identity else ""
    result = mochi.remote.request(wiki_id, "wikis", "page/edit/request", {
        "page": slug,
        "title": title,
        "content": content or "",
        "comment": comment,
        "author": from_entity,
        "name": a.user.identity.name if a.user and a.user.identity else "",
    })
    if result.get("error"):
        return {"error": "offline"}

    status = result.get("status")
    if not status:
        return {"error": "offline"}
    if status == "400":
        return {"error": result.get("error", "bad_request")}
    if status == "403":
        return {"error": "access_denied"}
    if status == "404":
        return {"error": "not_found"}
    if status != "200":
        return {"error": result.get("error", "unknown")}

    return {
        "id": result.get("id"),
        "slug": result.get("slug"),
        "version": result.get("version"),
        "created": result.get("created", False),
    }

# Helper: Get page by slug, following redirects
def get_page(wiki, slug):
    # Check for redirect first
    redirect = mochi.db.row("select target from redirects where wiki=? and source=?", wiki, slug)
    if redirect:
        slug = redirect["target"]

    page = mochi.db.row("select * from pages where wiki=? and page=? and deleted=0", wiki, slug)
    return page

# Helper: Create a revision for a page
def create_revision(page, title, content, author, name, version, comment):
    id = mochi.uid()
    now = mochi.time.now()
    mochi.db.execute("insert into revisions (id, page, content, title, author, name, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id, page, content, title, author, name, now, version, comment)
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
    if len(name) > 100:
        a.error(400, "Name too long (max 100 characters)")
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
    mochi.db.execute("insert into wikis (id, name, created) values (?, ?, ?)", entity, name, now)

    # Set up access rules based on privacy
    creator = a.user.identity.id
    resource = "wiki/" + entity
    if privacy == "public":
        mochi.access.allow("*", resource, "view", creator)
        mochi.access.allow("+", resource, "edit", creator)
    mochi.access.allow(creator, resource, "*", creator)

    return {"data": {"id": entity, "name": name}}

# Join an existing remote wiki by creating a local copy
def action_join(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    # Get the remote wiki entity ID
    source = a.input("target")
    if not source:
        a.error(400, "Target wiki entity ID is required")
        return

    # Check if we already have a wiki tracking this source
    existing = mochi.db.row("select * from wikis where source=?", source)
    if existing:
        a.error(400, "Already joined this wiki")
        return

    # Sync data from the remote wiki first to get the name
    dump = mochi.remote.request(source, "wikis", "sync", {})
    if dump.get("error") or dump.get("status") != "200":
        a.error(500, "Failed to sync from remote wiki")
        return

    # Get the wiki name from the sync response
    name = dump.get("name") or "Joined Wiki"

    # Create a new local entity for this wiki
    entity = mochi.entity.create("wiki", name, "public", "")
    if not entity:
        a.error(500, "Failed to create wiki entity")
        return

    # Register wiki in the database with source tracking
    now = mochi.time.now()
    mochi.db.execute("insert into wikis (id, name, home, source, created) values (?, ?, ?, ?, ?)",
        entity, name, dump.get("home") or "home", source, now)

    # Import the synced data into the new local wiki
    import_sync_dump(entity, dump)

    # Set up access rules - public view, authenticated edit, creator manages
    creator = a.user.identity.id
    resource = "wiki/" + entity
    mochi.access.allow("*", resource, "view", creator)
    mochi.access.allow("+", resource, "edit", creator)
    mochi.access.allow(creator, resource, "*", creator)

    # Subscribe to the source wiki to receive updates
    mochi.message.send(
        {"from": entity, "to": source, "service": "wikis", "event": "subscribe"},
        {"name": name}
    )

    return {"data": {"id": entity, "name": name, "source": source, "message": "Wiki joined successfully"}}

# Add a bookmark to follow an external wiki without making a local copy
def action_bookmark_add(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    # Get the remote wiki entity ID
    target = a.input("target")
    if not target:
        a.error(400, "Target wiki entity ID is required")
        return

    # Check if already bookmarked
    existing = mochi.db.row("select * from bookmarks where id=?", target)
    if existing:
        a.error(400, "Already bookmarked")
        return

    # Check if we already have this as a local wiki
    local = mochi.db.row("select * from wikis where id=? or source=?", target, target)
    if local:
        a.error(400, "This wiki is already in your list")
        return

    # Fetch the wiki name from the remote
    dump = mochi.remote.request(target, "wikis", "sync", {})
    if dump.get("error") or dump.get("status") != "200":
        a.error(500, "Failed to fetch wiki info")
        return

    name = dump.get("name") or "Bookmarked Wiki"
    now = mochi.time.now()

    mochi.db.execute("insert into bookmarks (id, name, added) values (?, ?, ?)", target, name, now)

    return {"data": {"id": target, "name": name, "message": "Wiki bookmarked"}}

# Remove a bookmark
def action_bookmark_remove(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    target = a.input("target")
    if not target:
        a.error(400, "Target wiki entity ID is required")
        return

    existing = mochi.db.row("select * from bookmarks where id=?", target)
    if not existing:
        a.error(404, "Bookmark not found")
        return

    mochi.db.execute("delete from bookmarks where id=?", target)

    return {"data": {"ok": True, "message": "Bookmark removed"}}

# Delete a wiki and all its data
def action_delete(a):
    if not a.user:
        a.error(401, "Authentication required")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error(403, "Access denied")
        return

    wiki_id = wiki["id"]

    # Delete all dependent data in order (respecting foreign keys)
    # 1. Delete tags (references pages)
    mochi.db.execute("""
        delete from tags where page in (
            select id from pages where wiki=?
        )
    """, wiki_id)

    # 2. Delete revisions (references pages)
    mochi.db.execute("""
        delete from revisions where page in (
            select id from pages where wiki=?
        )
    """, wiki_id)

    # 3. Delete pages
    mochi.db.execute("delete from pages where wiki=?", wiki_id)

    # 4. Delete redirects
    mochi.db.execute("delete from redirects where wiki=?", wiki_id)

    # 5. Delete subscribers
    mochi.db.execute("delete from subscribers where wiki=?", wiki_id)

    # 6. Delete wiki record
    mochi.db.execute("delete from wikis where id=?", wiki_id)

    # 7. Delete all attachments for this entity
    mochi.attachment.clear(wiki_id)

    # 8. Clear access rules
    mochi.access.clear.resource("wiki/" + wiki_id)

    # 9. Delete the entity from the entities table and directory
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
    # Add fingerprint (without hyphens) to each for shorter URLs
    wikis_raw = mochi.db.rows("select id, name, home, source, created from wikis order by name")
    wikis = [dict(w, fingerprint=mochi.entity.fingerprint(w["id"], False)) for w in wikis_raw]
    bookmarks_raw = mochi.db.rows("select id, name, added from bookmarks order by name")
    bookmarks = [dict(b, fingerprint=mochi.entity.fingerprint(b["id"], False)) for b in bookmarks_raw]
    return {"data": {"entity": False, "wikis": wikis, "bookmarks": bookmarks}}

# Search directory for remote wikis
def action_directory_search(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    search = a.input("search", "").strip()
    if not search:
        return {"data": {"results": []}}

    results = []

    # Check if search term is an entity ID
    if mochi.valid(search, "entity"):
        entry = mochi.directory.get(search)
        if entry and entry.get("class") == "wiki":
            results.append(entry)

    # Check if search term is a fingerprint (with or without hyphens)
    fingerprint = search.replace("-", "")
    if mochi.valid(fingerprint, "fingerprint"):
        all_wikis = mochi.directory.search("wiki", "", False)
        for entry in all_wikis:
            entry_fp = entry.get("fingerprint", "").replace("-", "")
            if entry_fp == fingerprint:
                # Avoid duplicates
                found = False
                for r in results:
                    if r.get("id") == entry.get("id"):
                        found = True
                        break
                if not found:
                    results.append(entry)
                break

    # Check if search term is a URL (e.g., https://example.com/wikis/ENTITY_ID)
    if search.startswith("http://") or search.startswith("https://"):
        url = search
        if "/wikis/" in url:
            parts = url.split("/wikis/", 1)
            wiki_path = parts[1]
            # Path format: /wikis/ENTITY_ID or /wikis/ENTITY_ID/...
            wiki_id = wiki_path.split("/")[0] if "/" in wiki_path else wiki_path
            if "?" in wiki_id:
                wiki_id = wiki_id.split("?")[0]
            if "#" in wiki_id:
                wiki_id = wiki_id.split("#")[0]

            if mochi.valid(wiki_id, "entity"):
                entry = mochi.directory.get(wiki_id)
                if entry and entry.get("class") == "wiki":
                    # Avoid duplicates
                    found = False
                    for r in results:
                        if r.get("id") == entry.get("id"):
                            found = True
                            break
                    if not found:
                        results.append(entry)

    # Search by name
    name_results = mochi.directory.search("wiki", search, False)
    for entry in name_results:
        # Avoid duplicates
        found = False
        for r in results:
            if r.get("id") == entry.get("id"):
                found = True
                break
        if not found:
            results.append(entry)

    return {"data": {"results": results}}

# Info endpoint for entity context - returns wiki info
def action_info_entity(a):
    wiki = get_wiki(a)
    if not wiki:
        # Check if this is a bookmark to a remote wiki
        wiki_id = a.input("wiki")
        bookmark = mochi.db.row("select * from bookmarks where id=?", wiki_id) if wiki_id else None
        if bookmark:
            # Fetch wiki info from remote
            remote_info = fetch_remote_wiki_info(a, wiki_id)

            # Check for errors
            if remote_info.get("error"):
                error = remote_info["error"]
                if error == "access_denied":
                    return a.error(403, "Access denied to this wiki")
                if error == "not_found":
                    return a.error(404, "Wiki not found")
                if error == "offline" or error == "bad_request":
                    # Remote wiki unreachable or invalid request, return cached bookmark info
                    fp = mochi.entity.fingerprint(wiki_id, True)
                    return {"data": {
                        "entity": True,
                        "bookmark": True,
                        "offline": True,
                        "wiki": {
                            "id": wiki_id,
                            "name": bookmark["name"],
                            "home": "home",
                            "created": bookmark["added"],
                        },
                        "permissions": {"view": True, "edit": False, "delete": False, "manage": False},
                        "fingerprint": fp
                    }}
                # Unknown error
                return a.error(500, "Error accessing wiki: " + error)

            # Success - return bookmark info with remote data
            fp = mochi.entity.fingerprint(wiki_id, True)
            remote_perms = remote_info.get("permissions") or {}
            return {"data": {
                "entity": True,
                "bookmark": True,
                "wiki": {
                    "id": wiki_id,
                    "name": remote_info.get("name") or bookmark["name"],
                    "home": remote_info.get("home") or "home",
                    "created": bookmark["added"],
                },
                "permissions": {
                    "view": remote_perms.get("view", True),
                    "edit": remote_perms.get("edit", False),
                    "delete": False,
                    "manage": False,
                },
                "fingerprint": fp
            }}
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error(403, "Access denied")
        return

    # Build permissions object (manage grants all permissions)
    if a.user:
        can_manage = check_access(a, wiki["id"], "manage")
        permissions = {
            "view": can_manage or check_access(a, wiki["id"], "view"),
            "edit": can_manage or check_access(a, wiki["id"], "edit"),
            "delete": can_manage or check_access(a, wiki["id"], "delete"),
            "manage": can_manage,
        }
    else:
        permissions = {"view": True, "edit": False, "delete": False, "manage": False}

    # Get fingerprint with hyphens for display
    fp = mochi.entity.fingerprint(wiki["id"], True)

    # Also include all wikis and bookmarks for sidebar display
    # Add fingerprint (without hyphens) to each for shorter URLs
    wikis_raw = mochi.db.rows("select id, name, home, source, created from wikis order by name")
    wikis = [dict(w, fingerprint=mochi.entity.fingerprint(w["id"], False)) for w in wikis_raw]
    bookmarks_raw = mochi.db.rows("select id, name, added from bookmarks order by name")
    bookmarks = [dict(b, fingerprint=mochi.entity.fingerprint(b["id"], False)) for b in bookmarks_raw]

    return {"data": {"entity": True, "wiki": wiki, "wikis": wikis, "bookmarks": bookmarks, "permissions": permissions, "fingerprint": fp}}

# View a page
def action_page(a):
    wiki = get_wiki(a)
    if not wiki:
        # Check if this is a bookmark to a remote wiki
        wiki_id = a.input("wiki")
        bookmark = mochi.db.row("select * from bookmarks where id=?", wiki_id) if wiki_id else None
        if bookmark:
            slug = a.input("page")
            if not slug:
                a.error(400, "Missing page parameter")
                return

            # Fetch page from remote wiki
            page = fetch_remote_page(a, wiki_id, slug)

            # Check for errors
            if page and page.get("error"):
                error = page["error"]
                if error == "access_denied":
                    return a.error(403, "Access denied to this wiki")
                if error == "not_found":
                    return {"data": {"error": "not_found", "page": slug, "bookmark": True}}
                if error == "offline" or error == "bad_request":
                    return a.error(503, "Wiki is offline")
                return a.error(500, "Error accessing wiki: " + error)

            if not page:
                return {"data": {"error": "not_found", "page": slug, "bookmark": True}}

            return {"data": {"page": page, "bookmark": True}}

        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error(403, "Access denied")
        return

    slug = a.input("page")
    if not slug:
        a.error(400, "Missing page parameter")
        return

    page = get_page(wiki["id"], slug)
    if not page:
        return {"data": {"error": "not_found", "page": slug}}

    # Get tags for this page
    tags = mochi.db.rows("select tag from tags where page=?", page["id"])
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
        # Check if this is a bookmark to a remote wiki
        wiki_id = a.input("wiki")
        bookmark = mochi.db.row("select * from bookmarks where id=?", wiki_id) if wiki_id else None
        if bookmark:
            # Send edit request to remote wiki
            result = send_remote_page_edit(a, wiki_id)
            if result.get("error"):
                error = result["error"]
                if error == "access_denied":
                    return a.error(403, "Access denied")
                if error == "not_found":
                    return a.error(404, "Wiki not found")
                if error == "offline":
                    return a.error(503, "Wiki is offline")
                return a.error(400, error)
            return {"data": result}
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error(403, "Access denied")
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
    if len(title) > 255:
        a.error(400, "Title too long (max 255 characters)")
        return

    if content == None:
        content = ""
    if len(content) > 1000000:
        a.error(400, "Content too long (max 1MB)")
        return

    if len(comment) > 500:
        a.error(400, "Comment too long (max 500 characters)")
        return

    author = a.user.identity.id
    name = a.user.identity.name

    now = mochi.time.now()
    source = wiki.get("source")

    # Check if page exists
    existing = mochi.db.row("select * from pages where wiki=? and page=?", wiki["id"], slug)

    if existing:
        # Update existing page
        if existing["deleted"]:
            # Restore deleted page
            version = existing["version"] + 1
            mochi.db.execute("update pages set title=?, content=?, author=?, updated=?, version=?, deleted=0 where id=?",
                title, content, author, now, version, existing["id"])
            create_revision(existing["id"], title, content, author, name, version, comment)
            # Notify: source broadcasts to subscribers, subscriber notifies source
            event_data = {
                "id": existing["id"],
                "page": slug,
                "title": title,
                "content": content,
                "author": author,
                "name": name,
                "created": now,
                "version": version
            }
            if source:
                mochi.message.send(
                    {"from": wiki["id"], "to": source, "service": "wikis", "event": "page/create"},
                    event_data
                )
            else:
                broadcast_event(wiki["id"], "page/create", event_data)
            return {"data": {"id": existing["id"], "slug": slug, "version": version, "created": False}}
        else:
            # Update page
            version = existing["version"] + 1
            mochi.db.execute("update pages set title=?, content=?, author=?, updated=?, version=? where id=?",
                title, content, author, now, version, existing["id"])
            create_revision(existing["id"], title, content, author, name, version, comment)
            # Notify: source broadcasts to subscribers, subscriber notifies source
            event_data = {
                "id": existing["id"],
                "page": slug,
                "title": title,
                "content": content,
                "author": author,
                "name": name,
                "updated": now,
                "version": version
            }
            if source:
                mochi.message.send(
                    {"from": wiki["id"], "to": source, "service": "wikis", "event": "page/update"},
                    event_data
                )
            else:
                broadcast_event(wiki["id"], "page/update", event_data)
            return {"data": {"id": existing["id"], "slug": slug, "version": version, "created": False}}
    else:
        # Create new page
        id = mochi.uid()
        mochi.db.execute("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, 1)",
            id, wiki["id"], slug, title, content, author, now, now)
        create_revision(id, title, content, author, name, 1, comment)
        # Notify: source broadcasts to subscribers, subscriber notifies source
        event_data = {
            "id": id,
            "page": slug,
            "title": title,
            "content": content,
            "author": author,
            "name": name,
            "created": now,
            "version": 1
        }
        if source:
            mochi.message.send(
                {"from": wiki["id"], "to": source, "service": "wikis", "event": "page/create"},
                event_data
            )
        else:
            broadcast_event(wiki["id"], "page/create", event_data)
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

    if not check_access(a, wiki["id"], "edit"):
        a.error(403, "Access denied")
        return

    slug = a.input("slug")
    title = a.input("title")
    content = a.input("content", "")

    if not slug:
        a.error(400, "Slug is required")
        return
    if len(slug) > 100:
        a.error(400, "Page URL too long (max 100 characters)")
        return
    # Validate slug characters (alphanumeric, hyphens, underscores)
    for c in slug.elems():
        if not (c.isalnum() or c in "-_"):
            a.error(400, "Page URL can only contain letters, numbers, hyphens, and underscores")
            return

    if not title:
        a.error(400, "Title is required")
        return
    if len(title) > 255:
        a.error(400, "Title too long (max 255 characters)")
        return

    if len(content) > 1000000:
        a.error(400, "Content too long (max 1MB)")
        return

    # Check if slug is reserved
    if slug.startswith("-"):
        a.error(400, "Page names starting with - are reserved")
        return

    author = a.user.identity.id
    name = a.user.identity.name
    source = wiki.get("source")

    # Check if page already exists
    existing = mochi.db.row("select id from pages where wiki=? and page=?", wiki["id"], slug)
    if existing:
        a.error(409, "Page already exists")
        return

    # Create the page locally
    now = mochi.time.now()
    id = mochi.uid()

    mochi.db.execute("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, 1)",
        id, wiki["id"], slug, title, content, author, now, now)
    create_revision(id, title, content, author, name, 1, "Initial creation")

    # Notify: source broadcasts to subscribers, subscriber notifies source
    event_data = {
        "id": id,
        "page": slug,
        "title": title,
        "content": content,
        "author": author,
        "name": name,
        "created": now,
        "version": 1
    }
    if source:
        mochi.message.send(
            {"from": wiki["id"], "to": source, "service": "wikis", "event": "page/create"},
            event_data
        )
    else:
        broadcast_event(wiki["id"], "page/create", event_data)

    return {"data": {"id": id, "slug": slug}}

# Page history
def action_page_history(a):
    wiki = get_wiki(a)
    if not wiki:
        # Check if this is a bookmark to a remote wiki
        wiki_id = a.input("wiki")
        bookmark = mochi.db.row("select * from bookmarks where id=?", wiki_id) if wiki_id else None
        if bookmark:
            slug = a.input("page")
            if not slug:
                a.error(400, "Missing page parameter")
                return

            # Fetch history from remote wiki
            result = fetch_remote_page_history(a, wiki_id, slug)

            # Check for errors
            if result and result.get("error"):
                error = result["error"]
                if error == "access_denied":
                    return a.error(403, "Access denied to this wiki")
                if error == "not_found":
                    return a.error(404, "Page not found")
                if error == "offline" or error == "bad_request":
                    return a.error(503, "Wiki is offline")
                return a.error(500, "Error accessing wiki: " + error)

            if not result:
                a.error(404, "Page not found")
                return

            return {"data": result}

        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error(403, "Access denied")
        return

    slug = a.input("page")
    if not slug:
        a.error(400, "Missing page parameter")
        return

    page = mochi.db.row("select * from pages where wiki=? and page=?", wiki["id"], slug)
    if not page:
        a.error(404, "Page not found")
        return

    revisions = mochi.db.rows("select id, title, author, name, created, version, comment from revisions where page=? order by version desc", page["id"])

    # Resolve author names - use stored name if available, else try to resolve
    for rev in revisions:
        if not rev["name"]:
            name = mochi.entity.name(rev["author"])
            if name:
                rev["name"] = name
            else:
                rev["name"] = rev["author"][:12] + "..."

    return {"data": {"page": slug, "revisions": revisions}}

# View a specific revision
def action_page_revision(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error(403, "Access denied")
        return

    slug = a.input("page")
    version = a.input("version")

    if not slug:
        a.error(400, "Missing page parameter")
        return

    if not version:
        a.error(400, "Missing version parameter")
        return

    page = mochi.db.row("select * from pages where wiki=? and page=?", wiki["id"], slug)
    if not page:
        a.error(404, "Page not found")
        return

    revision = mochi.db.row("select * from revisions where page=? and version=?", page["id"], int(version))
    if not revision:
        a.error(404, "Revision not found")
        return

    # Resolve author name
    name = mochi.entity.name(revision["author"])
    author_name = name if name else revision["author"][:12] + "..."

    return {"data": {
        "page": slug,
        "revision": {
            "id": revision["id"],
            "title": revision["title"],
            "content": revision["content"],
            "author": revision["author"],
            "author_name": author_name,
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

    if not check_access(a, wiki["id"], "edit"):
        a.error(403, "Access denied")
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

    source = wiki.get("source")

    page = mochi.db.row("select * from pages where wiki=? and page=?", wiki["id"], slug)
    if not page:
        a.error(404, "Page not found")
        return

    revision = mochi.db.row("select * from revisions where page=? and version=?", page["id"], int(version))
    if not revision:
        a.error(404, "Revision not found")
        return

    # Create new version with content from old revision
    now = mochi.time.now()
    author = a.user.identity.id
    name = a.user.identity.name
    newversion = page["version"] + 1

    if not comment:
        comment = "Reverted to version " + str(version)

    mochi.db.execute("update pages set title=?, content=?, author=?, updated=?, version=? where id=?",
        revision["title"], revision["content"], author, now, newversion, page["id"])
    create_revision(page["id"], revision["title"], revision["content"], author, name, newversion, comment)

    # Notify: source broadcasts to subscribers, subscriber notifies source
    event_data = {
        "id": page["id"],
        "page": slug,
        "title": revision["title"],
        "content": revision["content"],
        "author": author,
        "name": name,
        "updated": now,
        "version": newversion
    }
    if source:
        mochi.message.send(
            {"from": wiki["id"], "to": source, "service": "wikis", "event": "page/update"},
            event_data
        )
    else:
        broadcast_event(wiki["id"], "page/update", event_data)

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

    if not check_access(a, wiki["id"], "delete"):
        a.error(403, "Access denied")
        return

    slug = a.input("page")
    if not slug:
        a.error(400, "Missing page parameter")
        return

    source = wiki.get("source")

    page = mochi.db.row("select * from pages where wiki=? and page=? and deleted=0", wiki["id"], slug)
    if not page:
        a.error(404, "Page not found")
        return

    now = mochi.time.now()
    version = page["version"] + 1

    mochi.db.execute("update pages set deleted=?, version=? where id=?", now, version, page["id"])

    # Notify: source broadcasts to subscribers, subscriber notifies source
    event_data = {
        "id": page["id"],
        "deleted": now,
        "version": version
    }
    if source:
        mochi.message.send(
            {"from": wiki["id"], "to": source, "service": "wikis", "event": "page/delete"},
            event_data
        )
    else:
        broadcast_event(wiki["id"], "page/delete", event_data)

    return {"data": {"ok": True, "slug": slug}}

# Rename a page (and optionally child pages)
def action_page_rename(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error(403, "Access denied")
        return

    old_slug = a.input("page")
    new_slug = a.input("slug")
    rename_children = a.input("children", "true") == "true"
    create_redirects = a.input("redirects", "false") == "true"

    if not old_slug:
        a.error(400, "Missing page parameter")
        return

    if not new_slug:
        a.error(400, "New slug is required")
        return

    # Validate new slug
    if len(new_slug) > 100:
        a.error(400, "Page URL too long (max 100 characters)")
        return
    for c in new_slug.elems():
        if not (c.isalnum() or c in "-_"):
            a.error(400, "Page URL can only contain letters, numbers, hyphens, and underscores")
            return
    if new_slug.startswith("-"):
        a.error(400, "Page names starting with - are reserved")
        return

    # Can't rename to itself
    if old_slug == new_slug:
        a.error(400, "New slug is the same as the old slug")
        return

    source = wiki.get("source")
    author = a.user.identity.id
    name = a.user.identity.name
    now = mochi.time.now()

    # Get the page to rename
    page = mochi.db.row("select * from pages where wiki=? and page=? and deleted=0", wiki["id"], old_slug)
    if not page:
        a.error(404, "Page not found")
        return

    # Check new slug doesn't already exist
    existing = mochi.db.row("select 1 from pages where wiki=? and page=? and deleted=0", wiki["id"], new_slug)
    if existing:
        a.error(400, "A page with this slug already exists")
        return

    # Build list of pages to rename (main page + children if requested)
    pages_to_rename = [{"page": page, "old_slug": old_slug, "new_slug": new_slug}]

    if rename_children:
        children = mochi.db.rows("select * from pages where wiki=? and page like ? and deleted=0", wiki["id"], old_slug + "/%")
        for child in children:
            child_new_slug = new_slug + child["page"][len(old_slug):]
            # Check child's new slug doesn't exist
            child_existing = mochi.db.row("select 1 from pages where wiki=? and page=? and deleted=0", wiki["id"], child_new_slug)
            if child_existing:
                a.error(400, "A page with slug '" + child_new_slug + "' already exists")
                return
            pages_to_rename.append({"page": child, "old_slug": child["page"], "new_slug": child_new_slug})

    # Rename all pages
    renamed = []
    for item in pages_to_rename:
        p = item["page"]
        o = item["old_slug"]
        n = item["new_slug"]
        new_version = p["version"] + 1

        mochi.db.execute("update pages set page=?, version=?, updated=? where id=?", n, new_version, now, p["id"])
        create_revision(p["id"], p["title"], p["content"], author, name, new_version, "Renamed from " + o)
        renamed.append({"old": o, "new": n})

        # Create redirect if requested
        if create_redirects:
            mochi.db.execute("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki["id"], o, n, now)
            broadcast_event(wiki["id"], "redirect/set", {"source": o, "target": n, "created": now})

        # Broadcast page update
        event_data = {
            "id": p["id"],
            "page": n,
            "title": p["title"],
            "content": p["content"],
            "author": author,
            "name": name,
            "updated": now,
            "version": new_version
        }
        if source:
            mochi.message.send(
                {"from": wiki["id"], "to": source, "service": "wikis", "event": "page/update"},
                event_data
            )
        else:
            broadcast_event(wiki["id"], "page/update", event_data)

    # Update links in other pages
    # Build a map of old -> new slugs for replacement
    slug_map = {}
    renamed_ids = []
    for item in pages_to_rename:
        slug_map[item["old_slug"]] = item["new_slug"]
        renamed_ids.append(item["page"]["id"])

    updated_links = 0
    for old, new in slug_map.items():
        # Find pages containing links to this old slug
        pattern = "](" + old + ")"
        pages_with_links = mochi.db.rows("select * from pages where wiki=? and deleted=0 and content like ?", wiki["id"], "%" + pattern + "%")

        for p in pages_with_links:
            # Skip pages we already renamed (they might link to themselves)
            if p["id"] in renamed_ids:
                continue

            # Replace links in content
            new_content = p["content"].replace(pattern, "](" + new + ")")
            if new_content != p["content"]:
                new_version = p["version"] + 1
                mochi.db.execute("update pages set content=?, version=?, updated=?, author=? where id=?",
                    new_content, new_version, now, author, p["id"])
                create_revision(p["id"], p["title"], new_content, author, name, new_version, "Updated links: " + old + " → " + new)
                updated_links += 1

                # Broadcast update
                event_data = {
                    "id": p["id"],
                    "page": p["page"],
                    "title": p["title"],
                    "content": new_content,
                    "author": author,
                    "name": name,
                    "updated": now,
                    "version": new_version
                }
                if source:
                    mochi.message.send(
                        {"from": wiki["id"], "to": source, "service": "wikis", "event": "page/update"},
                        event_data
                    )
                else:
                    broadcast_event(wiki["id"], "page/update", event_data)

    return {"data": {"renamed": renamed, "updated_links": updated_links}}

# Add a tag to a page
def action_tag_add(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error(403, "Access denied")
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
    if len(tag) > 50:
        a.error(400, "Tag too long (max 50 characters)")
        return
    # Only allow alphanumeric, hyphens, and underscores
    for c in tag.elems():
        if not (c.isalnum() or c in "-_"):
            a.error(400, "Tags can only contain letters, numbers, hyphens, and underscores")
            return

    page = mochi.db.row("select id from pages where wiki=? and page=? and deleted=0", wiki["id"], slug)
    if not page:
        a.error(404, "Page not found")
        return

    # Check if tag already exists
    existing = mochi.db.row("select 1 from tags where page=? and tag=?", page["id"], tag)
    if existing:
        return {"data": {"ok": True, "added": False}}

    mochi.db.execute("insert into tags (page, tag) values (?, ?)", page["id"], tag)

    # Send tag/add event: subscriber notifies source, owner broadcasts to subscribers
    event_data = {"page": page["id"], "tag": tag}
    source = wiki.get("source")
    if source:
        mochi.message.send(
            {"from": wiki["id"], "to": source, "service": "wikis", "event": "tag/add"},
            event_data
        )
    else:
        broadcast_event(wiki["id"], "tag/add", event_data)

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

    if not check_access(a, wiki["id"], "edit"):
        a.error(403, "Access denied")
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

    page = mochi.db.row("select id from pages where wiki=? and page=? and deleted=0", wiki["id"], slug)
    if not page:
        a.error(404, "Page not found")
        return

    mochi.db.execute("delete from tags where page=? and tag=?", page["id"], tag)

    # Send tag/remove event: subscriber notifies source, owner broadcasts to subscribers
    event_data = {"page": page["id"], "tag": tag}
    source = wiki.get("source")
    if source:
        mochi.message.send(
            {"from": wiki["id"], "to": source, "service": "wikis", "event": "tag/remove"},
            event_data
        )
    else:
        broadcast_event(wiki["id"], "tag/remove", event_data)

    return {"data": {"ok": True}}

# List all tags in the wiki
def action_tags(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error(403, "Access denied")
        return

    tags = mochi.db.rows("""
        select t.tag, count(*) as count
        from tags t
        join pages p on p.id=t.page
        where p.wiki=? and p.deleted=0
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

    if not check_access(a, wiki["id"], "view"):
        a.error(403, "Access denied")
        return

    tag = a.input("tag")

    if not tag:
        a.error(400, "Missing tag parameter")
        return

    tag = tag.lower().strip()

    pages = mochi.db.rows("""
        select p.page, p.title, p.updated
        from pages p
        join tags t on t.page=p.id
        where p.wiki=? and t.tag=? and p.deleted=0
        order by p.updated desc
    """, wiki["id"], tag)

    return {"data": {"tag": tag, "pages": pages}}

# Recent changes across the wiki
def action_changes(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error(403, "Access denied")
        return

    # Get recent revisions with page info
    changes = mochi.db.rows("""
        select r.id, r.title, r.author, r.name, r.created, r.version, r.comment,
               p.page as slug
        from revisions r
        join pages p on p.id=r.page
        where p.wiki=? and p.deleted=0
        order by r.created desc
        limit 100
    """, wiki["id"])

    # Resolve author names where not stored
    for change in changes:
        if not change["name"]:
            name = mochi.entity.name(change["author"])
            if name:
                change["name"] = name
            else:
                change["name"] = change["author"][:12] + "..."

    return {"data": {"changes": changes}}

# Create or update a redirect
def action_redirect_set(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error(403, "Access denied")
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

    if len(source) > 100:
        a.error(400, "Source too long (max 100 characters)")
        return
    if len(target) > 100:
        a.error(400, "Target too long (max 100 characters)")
        return

    if source == target:
        a.error(400, "Source and target cannot be the same")
        return

    # Check if source is a reserved path
    if source.startswith("-"):
        a.error(400, "Cannot redirect reserved paths")
        return

    # Check if target page exists
    targetpage = mochi.db.row("select id from pages where wiki=? and page=? and deleted=0", wiki["id"], target)
    if not targetpage:
        a.error(400, "Target page does not exist")
        return

    # Check if source conflicts with an existing page
    sourcepage = mochi.db.row("select id from pages where wiki=? and page=? and deleted=0", wiki["id"], source)
    if sourcepage:
        a.error(400, "Cannot redirect: a page with this slug already exists")
        return

    now = mochi.time.now()
    mochi.db.execute("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki["id"], source, target, now)

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

    if not check_access(a, wiki["id"], "edit"):
        a.error(403, "Access denied")
        return

    source = a.input("source")

    if not source:
        a.error(400, "Source is required")
        return

    source = source.lower().strip()
    mochi.db.execute("delete from redirects where wiki=? and source=?", wiki["id"], source)

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

    if not check_access(a, wiki["id"], "view"):
        a.error(403, "Access denied")
        return

    redirects = mochi.db.rows("select source, target, created from redirects where wiki=? order by source", wiki["id"])
    return {"data": {"redirects": redirects}}

# View wiki settings
def action_settings(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error(403, "Access denied")
        return

    return {"data": {"settings": {"home": wiki["home"], "source": wiki.get("source", "")}}}

# Update a wiki setting
def action_settings_set(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error(403, "Access denied")
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
        if not value:
            a.error(400, "Home page is required")
            return
        if len(value) > 100:
            a.error(400, "Home page slug too long (max 100 characters)")
            return
        for c in value.elems():
            if not (c.isalnum() or c in "-_/"):
                a.error(400, "Home page can only contain letters, numbers, hyphens, underscores, and slashes")
                return
        mochi.db.execute("update wikis set home=? where id=?", value, wiki["id"])
    else:
        a.error(400, "Unknown setting: " + name)
        return

    # Send setting/set event
    broadcast_event(wiki["id"], "setting/set", {
        "name": name,
        "value": value
    })

    return {"data": {"ok": True}}

# Rename a wiki
def action_rename(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error(403, "Access denied")
        return

    name = a.input("name")
    if not name or not mochi.valid(name, "name"):
        a.error(400, "Invalid name")
        return

    if len(name) > 100:
        a.error(400, "Name is too long (max 100 characters)")
        return

    # Update entity (handles directory, network publishing)
    mochi.entity.update(wiki["id"], name=name)

    # Update local database
    mochi.db.execute("update wikis set name=? where id=?", name, wiki["id"])

    # Broadcast to subscribers
    broadcast_event(wiki["id"], "rename", {"name": name})

    return {"data": {"success": True}}

# SUBSCRIBERS

# List subscribers for a source wiki
def action_subscribers(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error(403, "Access denied")
        return

    # Only source wikis have subscribers
    if wiki.get("source"):
        return {"data": {"subscribers": []}}

    subscribers = mochi.db.rows("select id, name, subscribed, seen from subscribers where wiki=? order by name", wiki["id"])

    # Look up current names from directory to avoid stale names
    for sub in subscribers:
        info = mochi.directory.get(sub["id"])
        if info and info.get("name"):
            sub["name"] = info["name"]

    return {"data": {"subscribers": subscribers}}

# Remove a subscriber
def action_subscriber_remove(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error(403, "Access denied")
        return

    subscriber_id = a.input("subscriber")
    if not subscriber_id:
        a.error(400, "Subscriber ID is required")
        return

    mochi.db.execute("delete from subscribers where wiki=? and id=?", wiki["id"], subscriber_id)

    # Revoke any access permissions for the removed subscriber
    resource = "wiki/" + wiki["id"]
    for op in ACCESS_LEVELS + ["*"]:
        mochi.access.revoke(subscriber_id, resource, op)

    return {"data": {"ok": True}}

# Unsubscribe from a wiki (subscriber action)
def action_unsubscribe(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki_id = a.input("wiki")
    if not wiki_id:
        a.error(400, "Wiki ID is required")
        return

    # Check wiki exists locally (we're subscribed to it)
    wiki = mochi.db.row("select * from wikis where id=?", wiki_id)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    # Cannot unsubscribe from own wiki
    if wiki["source"] == "":
        a.error(400, "Cannot unsubscribe from your own wiki")
        return

    # Delete all local data for this wiki
    mochi.db.execute("delete from tags where page in (select id from pages where wiki=?)", wiki_id)
    mochi.db.execute("delete from revisions where page in (select id from pages where wiki=?)", wiki_id)
    mochi.db.execute("delete from pages where wiki=?", wiki_id)
    mochi.db.execute("delete from redirects where wiki=?", wiki_id)
    mochi.db.execute("delete from subscribers where wiki=?", wiki_id)
    mochi.db.execute("delete from wikis where id=?", wiki_id)

    # Notify wiki owner
    mochi.message.send(
        {"from": a.user.identity.id, "to": wiki_id, "service": "wikis", "event": "unsubscribe"},
        {},
        []
    )

    return {"data": {"ok": True}}

# ACCESS CONTROL

# List access rules for the wiki
def action_access_list(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error(403, "Access denied")
        return

    # Get owner - if we own this entity, use current user's info
    owner = None
    if mochi.entity.get(wiki["id"]):
        # Current user is the owner
        if a.user and a.user.identity:
            owner = {"id": a.user.identity.id, "name": a.user.identity.name}

    resource = "wiki/" + wiki["id"]
    rules = mochi.access.list.resource(resource)

    # Resolve names for rules and mark owner
    filtered_rules = []
    for rule in rules:
        subject = rule.get("subject", "")
        # Mark owner rules
        if owner and subject == owner.get("id"):
            rule["isOwner"] = True
        # Skip legacy #administrator rules
        if subject == "#administrator":
            continue
        # Resolve names for non-special subjects
        if subject and subject not in ("*", "+") and not subject.startswith("#"):
            if subject.startswith("@"):
                # Look up group name
                group_id = subject[1:]  # Remove @ prefix
                group = mochi.group.get(group_id)
                if group:
                    rule["name"] = group.get("name", group_id)
            elif mochi.valid(subject, "entity"):
                # Try directory first (for user identities), then local entities
                entry = mochi.directory.get(subject)
                if entry:
                    rule["name"] = entry.get("name", "")
                else:
                    entity = mochi.entity.info(subject)
                    if entity:
                        rule["name"] = entity.get("name", "")
        filtered_rules.append(rule)

    return {"data": {"rules": filtered_rules}}

# Set access level for a subject
# Levels: "edit" (can edit, delete, view), "view" (can view only), "none" (explicitly blocked)
# This revokes any existing rules for the subject first, then sets the new level.
def action_access_set(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error(403, "Access denied")
        return

    subject = a.input("subject")
    level = a.input("level")

    if not subject:
        a.error(400, "Subject is required")
        return
    if len(subject) > 255:
        a.error(400, "Subject too long")
        return

    if not level:
        a.error(400, "Level is required")
        return

    if level not in ["view", "edit", "none"]:
        a.error(400, "Invalid level")
        return

    resource = "wiki/" + wiki["id"]
    granter = a.user.identity.id

    # First, revoke all existing rules for this subject (including wildcard)
    for op in ACCESS_LEVELS + ["*"]:
        mochi.access.revoke(subject, resource, op)

    # Then set the new level
    if level == "none":
        # Store deny rules for all levels to block access
        for op in ACCESS_LEVELS:
            mochi.access.deny(subject, resource, op, granter)
    else:
        # Store a single allow rule for the level
        mochi.access.allow(subject, resource, level, granter)

    return {"data": {"success": True}}

# Revoke all access from a subject (remove from access list entirely)
def action_access_revoke(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error(403, "Access denied")
        return

    subject = a.input("subject")

    if not subject:
        a.error(400, "Subject is required")
        return
    if len(subject) > 255:
        a.error(400, "Subject too long")
        return

    resource = "wiki/" + wiki["id"]

    # Revoke all rules for this subject (including wildcard)
    for op in ACCESS_LEVELS + ["*"]:
        mochi.access.revoke(subject, resource, op)

    return {"data": {"success": True}}

# Search pages by title and content
def action_search(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error(403, "Access denied")
        return

    query = a.input("q", "")

    if not query or len(query.strip()) == 0:
        return {"data": {"query": "", "results": []}}

    query = query.strip()

    # Use LIKE for simple search (SQLite FTS could be added later for better performance)
    pattern = "%" + query + "%"

    results = mochi.db.rows("""
        select page, title, substr(content, 1, 200) as excerpt, updated
        from pages
        where wiki=? and deleted=0 and (title like ? or content like ?)
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
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return

    id = e.content("id")
    page = e.content("page")
    title = e.content("title")
    content = e.content("content")
    author = e.content("author")
    created = e.content("created")
    version = e.content("version")
    name = e.content("name") or ""

    # Validate required fields
    if not id or not page or not title or not author or not created or not version:
        return

    # Validate timestamp is within reasonable range (not more than 1 day in future or 1 year in past)
    now = mochi.time.now()
    if created > now + 86400 or created < now - 31536000:
        return

    # Check if page already exists
    existing = mochi.db.row("select * from pages where id=?", id)

    if existing:
        # Apply conflict resolution
        if not should_apply_update(existing, version, created, author):
            return

        # Update existing page (may be restoring a deleted page)
        mochi.db.execute("update pages set page=?, title=?, content=?, author=?, created=?, updated=?, version=?, deleted=0 where id=?",
            page, title, content, author, created, created, version, id)
    else:
        # Insert new page
        mochi.db.execute("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id, wiki, page, title, content, author, created, created, version)

    # Create revision record with author name
    revid = mochi.uid()
    mochi.db.execute("insert or ignore into revisions (id, page, content, title, author, name, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, ?, '')",
        revid, id, content, title, author, name, created, version)

    # If this is a source wiki and event is from a subscriber, re-broadcast to other subscribers
    if not wikirow.get("source") and sender:
        broadcast_event(wiki, "page/create", {
            "id": id,
            "page": page,
            "title": title,
            "content": content,
            "author": author,
            "name": name,
            "created": created,
            "version": version
        }, exclude=sender)

# Receive page/update event
def event_page_update(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Ensure wiki exists in database
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return

    id = e.content("id")
    page = e.content("page")
    title = e.content("title")
    content = e.content("content")
    author = e.content("author")
    updated = e.content("updated")
    version = e.content("version")
    name = e.content("name") or ""

    # Validate required fields
    if not id or not page or not title or not author or not updated or not version:
        return

    # Check if page exists
    existing = mochi.db.row("select * from pages where id=?", id)

    if not existing:
        # Page doesn't exist locally - create it
        mochi.db.execute("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id, wiki, page, title, content, author, updated, updated, version)
    else:
        # Apply conflict resolution
        if not should_apply_update(existing, version, updated, author):
            return

        # Update page
        mochi.db.execute("update pages set page=?, title=?, content=?, author=?, updated=?, version=? where id=?",
            page, title, content, author, updated, version, id)

    # Create revision record with author name
    revid = mochi.uid()
    mochi.db.execute("insert or ignore into revisions (id, page, content, title, author, name, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, ?, '')",
        revid, id, content, title, author, name, updated, version)

    # If this is a source wiki and event is from a subscriber, re-broadcast to other subscribers
    if not wikirow.get("source") and sender:
        broadcast_event(wiki, "page/update", {
            "id": id,
            "page": page,
            "title": title,
            "content": content,
            "author": author,
            "name": name,
            "updated": updated,
            "version": version
        }, exclude=sender)

# Receive page/delete event
def event_page_delete(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Ensure wiki exists in database
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return

    id = e.content("id")
    deleted = e.content("deleted")
    version = e.content("version")

    # Validate required fields
    if not id or not deleted or not version:
        return

    # Check if page exists
    existing = mochi.db.row("select * from pages where id=?", id)
    if not existing:
        return

    # Only delete if incoming version is higher
    if version <= existing["version"]:
        return

    # Soft delete
    mochi.db.execute("update pages set deleted=?, version=? where id=?", deleted, version, id)

    # If this is a source wiki and event is from a subscriber, re-broadcast to other subscribers
    if not wikirow.get("source") and sender:
        broadcast_event(wiki, "page/delete", {
            "id": id,
            "deleted": deleted,
            "version": version
        }, exclude=sender)

# Receive redirect/set event
def event_redirect_set(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Ensure wiki exists in database
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return

    source = e.content("source")
    target = e.content("target")
    created = e.content("created")

    # Validate required fields
    if not source or not target or not created:
        return

    # Validate timestamp is within reasonable range (not more than 1 day in future or 1 year in past)
    now = mochi.time.now()
    if created > now + 86400 or created < now - 31536000:
        return

    # Insert or update redirect
    mochi.db.execute("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki, source, target, created)

# Receive redirect/delete event
def event_redirect_delete(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Ensure wiki exists in database
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return

    source = e.content("source")

    # Validate required fields
    if not source:
        return

    mochi.db.execute("delete from redirects where wiki=? and source=?", wiki, source)

# Receive tag/add event
def event_tag_add(e):
    page = e.content("page")
    tag = e.content("tag")

    # Validate required fields
    if not page or not tag:
        return

    # Check if page exists and get wiki
    pagerow = mochi.db.row("select wiki from pages where id=?", page)
    if not pagerow:
        return

    wiki = pagerow["wiki"]
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return

    # Insert tag (ignore if already exists)
    mochi.db.execute("insert or ignore into tags (page, tag) values (?, ?)", page, tag)

# Receive tag/remove event
def event_tag_remove(e):
    page = e.content("page")
    tag = e.content("tag")

    # Validate required fields
    if not page or not tag:
        return

    # Check if page exists and get wiki
    pagerow = mochi.db.row("select wiki from pages where id=?", page)
    if not pagerow:
        return

    wiki = pagerow["wiki"]
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return

    mochi.db.execute("delete from tags where page=? and tag=?", page, tag)

# Receive setting/set event
def event_setting_set(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Ensure wiki exists in database
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return

    name = e.content("name")
    value = e.content("value")

    # Validate required fields
    if not name or value == None:
        return

    # Only allow known settings
    if name == "home":
        mochi.db.execute("update wikis set home=? where id=?", value, wiki)

# Handle rename event from source wiki
def event_rename(e):
    wiki_id = e.header("from")
    name = e.content("name")
    if not name:
        return

    # Update subscribed wiki (source = sender)
    wiki = mochi.db.row("select id from wikis where source=?", wiki_id)
    if wiki:
        mochi.db.execute("update wikis set name=? where id=?", name, wiki["id"])

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

    # Use UPSERT to handle concurrent subscribe requests atomically
    # New subscriber: set subscribed to now, seen to 0
    # Existing subscriber: update name only (don't reset timestamps)
    mochi.db.execute("""insert into subscribers (wiki, id, name, subscribed, seen) values (?, ?, ?, ?, 0)
        on conflict(wiki, id) do update set name=excluded.name""",
        wiki, subscriber, name, now)

# Handle unsubscription notification - remove subscriber and revoke access
def event_unsubscribe(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Get the subscriber's entity ID from message header
    subscriber = e.header("from")
    if not subscriber:
        return

    # Remove from subscribers table
    mochi.db.execute("delete from subscribers where wiki=? and id=?", wiki, subscriber)

    # Revoke all access permissions
    resource = "wiki/" + wiki
    for op in ACCESS_LEVELS + ["*"]:
        mochi.access.revoke(subscriber, resource, op)

# INITIAL SYNC

# Handle sync request - send full wiki dump to requester
def event_sync(e):
    wiki = e.header("to")
    if not wiki:
        e.write({"status": "400", "error": "Missing wiki ID"})
        return

    # Verify wiki exists
    if not mochi.db.exists("select 1 from wikis where id=?", wiki):
        e.write({"status": "404", "error": "Wiki not found"})
        return

    # Check if requester has view access
    requester = e.header("from")
    if not check_event_access(requester, wiki, "view"):
        e.write({"status": "403", "error": "Access denied"})
        return

    # Determine requester's permissions
    can_edit = check_event_access(requester, wiki, "edit")

    # Generate full dump of all wiki data
    pages = mochi.db.rows("select * from pages where wiki=?", wiki)

    # Get all revisions and tags for pages in this wiki using joins
    revisions = mochi.db.rows("""
        select r.* from revisions r
        join pages p on p.id = r.page
        where p.wiki = ?
    """, wiki)
    tags = mochi.db.rows("""
        select t.* from tags t
        join pages p on p.id = t.page
        where p.wiki = ?
    """, wiki)

    redirects = mochi.db.rows("select * from redirects where wiki=?", wiki)
    wikirow = mochi.db.row("select name, home from wikis where id=?", wiki)
    attachments = mochi.attachment.list(wiki) or []

    # Send dump as a single payload
    e.write({
        "status": "200",
        "source": wiki,  # Source wiki entity ID for attachment fetching
        "name": wikirow["name"] if wikirow else "",
        "home": wikirow["home"] if wikirow else "home",
        "permissions": {"view": True, "edit": can_edit},
        "pages": pages,
        "revisions": revisions,
        "tags": tags,
        "redirects": redirects,
        "attachments": attachments,
    })

# Handle remote page edit request from a subscriber (stream-based)
def event_page_edit_request(e):
    wiki = e.header("to")
    if not wiki:
        e.write({"status": "400", "error": "Missing wiki ID"})
        return

    # Verify wiki exists and is a source wiki (not a subscriber)
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        e.write({"status": "404", "error": "Wiki not found"})
        return

    if wikirow.get("source"):
        e.write({"status": "400", "error": "Cannot edit a subscriber wiki remotely"})
        return

    # Check access for the remote user
    remote_user = e.header("from")
    if not check_event_access(remote_user, wiki, "edit"):
        e.write({"status": "403", "error": "Access denied"})
        return

    # Get the edit request data from initial content (sent as second arg to mochi.stream)
    slug = e.content("page")
    title = e.content("title")
    content = e.content("content")
    comment = e.content("comment") or ""
    author = e.content("author") or remote_user
    name = e.content("name") or ""

    if not slug:
        e.write({"status": "400", "error": "Missing page parameter"})
        return

    if not title:
        e.write({"status": "400", "error": "Title is required"})
        return
    if len(title) > 255:
        e.write({"status": "400", "error": "Title too long (max 255 characters)"})
        return

    if content == None:
        content = ""
    if len(content) > 1000000:
        e.write({"status": "400", "error": "Content too long (max 1MB)"})
        return

    if len(comment) > 500:
        e.write({"status": "400", "error": "Comment too long (max 500 characters)"})
        return

    now = mochi.time.now()

    # Check if page exists
    existing = mochi.db.row("select * from pages where wiki=? and page=?", wiki, slug)

    if existing:
        if existing["deleted"]:
            # Restore deleted page
            version = existing["version"] + 1
            mochi.db.execute("update pages set title=?, content=?, author=?, updated=?, version=?, deleted=0 where id=?",
                title, content, author, now, version, existing["id"])
            create_revision(existing["id"], title, content, author, name, version, comment)
            broadcast_event(wiki, "page/create", {
                "id": existing["id"],
                "page": slug,
                "title": title,
                "content": content,
                "author": author,
                "name": name,
                "created": now,
                "version": version
            })
            e.write({"status": "200", "id": existing["id"], "slug": slug, "version": version, "created": False})
        else:
            # Update page
            version = existing["version"] + 1
            mochi.db.execute("update pages set title=?, content=?, author=?, updated=?, version=? where id=?",
                title, content, author, now, version, existing["id"])
            create_revision(existing["id"], title, content, author, name, version, comment)
            broadcast_event(wiki, "page/update", {
                "id": existing["id"],
                "page": slug,
                "title": title,
                "content": content,
                "author": author,
                "name": name,
                "updated": now,
                "version": version
            })
            e.write({"status": "200", "id": existing["id"], "slug": slug, "version": version, "created": False})
    else:
        # Create new page
        id = mochi.uid()
        mochi.db.execute("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, 1)",
            id, wiki, slug, title, content, author, now, now)
        create_revision(id, title, content, author, name, 1, comment)
        broadcast_event(wiki, "page/create", {
            "id": id,
            "page": slug,
            "title": title,
            "content": content,
            "author": author,
            "name": name,
            "created": now,
            "version": 1
        })
        e.write({"status": "200", "id": id, "slug": slug, "version": 1, "created": True})

# Handle remote page delete request from a subscriber (stream-based)
def event_page_delete_request(e):
    wiki = e.header("to")
    if not wiki:
        e.write({"status": "400", "error": "Missing wiki ID"})
        return

    # Verify wiki exists and is a source wiki (not a subscriber)
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        e.write({"status": "404", "error": "Wiki not found"})
        return

    if wikirow.get("source"):
        e.write({"status": "400", "error": "Cannot delete from a subscriber wiki remotely"})
        return

    # Check access for the remote user
    remote_user = e.header("from")
    if not check_event_access(remote_user, wiki, "edit"):
        e.write({"status": "403", "error": "Access denied"})
        return

    # Get the delete request data from initial content (sent as second arg to mochi.stream)
    slug = e.content("page")
    if not slug:
        e.write({"status": "400", "error": "Missing page parameter"})
        return

    # Check if page exists
    page = mochi.db.row("select * from pages where wiki=? and page=?", wiki, slug)
    if not page:
        e.write({"status": "404", "error": "Page not found"})
        return

    if page["deleted"]:
        e.write({"status": "400", "error": "Page already deleted"})
        return

    # Mark page as deleted with timestamp and increment version
    now = mochi.time.now()
    version = page["version"] + 1
    mochi.db.execute("update pages set deleted=?, version=?, updated=? where id=?", now, version, now, page["id"])

    # Broadcast delete event to subscribers
    broadcast_event(wiki, "page/delete", {
        "id": page["id"],
        "deleted": now,
        "version": version,
    })

    e.write({"status": "200", "deleted": slug})

# Handle remote attachment upload request from a subscriber (stream-based)
def event_attachment_upload_request(e):
    wiki = e.header("to")
    if not wiki:
        e.write({"status": "400", "error": "Missing wiki ID"})
        return

    # Verify wiki exists and is a source wiki (not a subscriber)
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        e.write({"status": "404", "error": "Wiki not found"})
        return

    if wikirow.get("source"):
        e.write({"status": "400", "error": "Cannot upload to a subscriber wiki remotely"})
        return

    # Check access for the remote user
    remote_user = e.header("from")
    if not check_event_access(remote_user, wiki, "edit"):
        e.write({"status": "403", "error": "Access denied"})
        return

    # Get upload metadata from message content
    name = e.content("name")
    content_type = e.content("content_type") or ""

    if not name:
        e.write({"status": "400", "error": "File name is required"})
        return

    # Get subscribers for notification
    subscribers = mochi.db.rows("select id from subscribers where wiki=? and id!=?", wiki, wiki)
    notify = [s["id"] for s in subscribers]

    # Stream directly to attachment storage (no temp file needed)
    attachment = mochi.attachment.create_from_stream(wiki, name, e.stream, content_type, "", "", notify)

    if not attachment:
        e.write({"status": "500", "error": "Failed to create attachment"})
        return

    e.write({"status": "200", "attachment": attachment})

# Handle attachment/create event - subscriber notifies source that they uploaded an attachment
# Source fetches the file from subscriber via stream and saves locally
def event_attachment_create(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Verify wiki exists and is a source wiki (not a subscriber)
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    if wikirow.get("source"):
        # This wiki is itself a subscriber, ignore
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return

    # Get attachment metadata from event content
    attachment_id = e.content("id")
    name = e.content("name")
    size = e.content("size")
    content_type = e.content("content_type") or ""
    created = e.content("created")
    subscriber = e.content("subscriber")

    if not attachment_id or not name or not subscriber:
        return

    # Validate timestamp is within reasonable range (not more than 1 day in future or 1 year in past)
    if created:
        now = mochi.time.now()
        if created > now + 86400 or created < now - 31536000:
            return

    # Check if we already have this attachment
    if mochi.attachment.exists(attachment_id):
        mochi.log.debug("Attachment %s already exists, skipping", attachment_id)
        return

    mochi.log.info("Fetching attachment %s from subscriber %s", attachment_id, subscriber)

    # Open stream to subscriber to fetch the file data
    stream = mochi.stream(
        {"from": wiki, "to": subscriber, "service": "wikis", "event": "attachment/fetch"},
        {"id": attachment_id}
    )

    if not stream:
        mochi.log.error("Failed to open stream to subscriber %s", subscriber)
        return

    # Read response status first
    response = stream.read()
    mochi.log.debug("Fetch response: %s", response)
    if not response or response.get("status") != "200":
        mochi.log.error("Failed to fetch attachment %s from subscriber %s: %s",
            attachment_id, subscriber, response.get("error") if response else "no response")
        return

    # Get subscribers for notification (excluding the one who uploaded)
    subscribers = mochi.db.rows("select id from subscribers where wiki=? and id!=?", wiki, subscriber)
    notify = [s["id"] for s in subscribers]

    # Stream directly to attachment storage with the original ID (no temp file needed)
    attachment = mochi.attachment.create_from_stream(wiki, name, stream, content_type, "", "", notify, attachment_id)

    if attachment:
        mochi.log.debug("Created attachment %s from subscriber %s", attachment_id, subscriber)

# Handle attachment/delete event - subscriber notifies source that they deleted an attachment
# Source deletes locally and broadcasts to other subscribers
def event_attachment_delete(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Verify wiki exists and is a source wiki (not a subscriber)
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    if wikirow.get("source"):
        # This wiki is itself a subscriber, ignore
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return

    attachment_id = e.content("id")

    if not attachment_id:
        return

    # Get subscribers for notification (excluding the one who deleted)
    subscribers = mochi.db.rows("select id from subscribers where wiki=? and id!=?", wiki, sender)
    notify = [s["id"] for s in subscribers]

    # Delete locally and notify other subscribers
    mochi.attachment.delete(attachment_id, notify)
    mochi.log.debug("Deleted attachment %s from subscriber %s, notified %d others", attachment_id, sender, len(notify))

# Handle attachment/fetch event - serve attachment file data to requester via stream
def event_attachment_fetch(e):
    wiki = e.header("to")
    if not wiki:
        e.write({"status": "400", "error": "Missing wiki ID"})
        return

    # Check if requester has view access
    requester = e.header("from")
    if not check_event_access(requester, wiki, "view"):
        e.write({"status": "403", "error": "Access denied"})
        return

    # Get attachment ID from event content (sent as second arg to mochi.stream)
    attachment_id = e.content("id")
    mochi.log.debug("attachment/fetch request for id=%s", attachment_id)
    if not attachment_id:
        e.write({"status": "400", "error": "Attachment ID is required"})
        return

    # Get the attachment file path
    path = mochi.attachment.path(attachment_id)
    mochi.log.debug("attachment/fetch path=%s", path)
    if not path:
        e.write({"status": "404", "error": "Attachment not found"})
        return

    # Send success status, then file data
    e.write({"status": "200"})
    bytes_written = e.stream.write_from_file(path)
    mochi.log.debug("attachment/fetch sent %s bytes", bytes_written)

# Helper: Import wiki dump from sync response
def import_sync_dump(wiki, dump):
    if not dump or dump.get("status") != "200":
        return False

    # Import pages
    pages = dump.get("pages") or []
    for p in pages:
        existing = mochi.db.row("select version from pages where id=?", p["id"])
        if existing and existing["version"] >= p["version"]:
            continue
        mochi.db.execute("replace into pages (id, wiki, page, title, content, author, created, updated, version, deleted) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            p["id"], wiki, p["page"], p["title"], p["content"], p["author"], p["created"], p["updated"], p["version"], p.get("deleted", 0))

    # Import revisions
    revisions = dump.get("revisions") or []
    for r in revisions:
        mochi.db.execute("insert or ignore into revisions (id, page, content, title, author, name, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            r["id"], r["page"], r["content"], r["title"], r["author"], r.get("name", ""), r["created"], r["version"], r.get("comment", ""))

    # Import tags
    tags = dump.get("tags") or []
    for t in tags:
        mochi.db.execute("insert or ignore into tags (page, tag) values (?, ?)", t["page"], t["tag"])

    # Import redirects
    redirects = dump.get("redirects") or []
    for r in redirects:
        mochi.db.execute("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki, r["source"], r["target"], r["created"])

    # Import wiki name and home setting
    name = dump.get("name")
    home = dump.get("home")
    if name or home:
        mochi.db.execute("update wikis set name=?, home=? where id=?",
            name or "", home or "home", wiki)

    # Import attachments (store with local wiki as object, remote as entity for fetching)
    attachments = dump.get("attachments") or []
    source = dump.get("source", "")  # Remote wiki entity ID for on-demand fetching
    for att in attachments:
        mochi.db.execute("""replace into _attachments
            (id, object, entity, name, size, content_type, creator, caption, description, rank, created)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            att.get("id"), wiki, source, att.get("name", ""),
            att.get("size", 0), att.get("content_type") or att.get("type", ""), att.get("creator", ""),
            att.get("caption", ""), att.get("description", ""), att.get("rank", 0), att.get("created", 0))

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
        {"from": wiki["id"], "to": target, "service": "wikis", "event": "subscribe"},
        {"name": a.user.identity.name or ""}
    )

    return {"data": {"ok": True, "message": "Subscription request sent"}}

# Request sync from upstream wiki
def action_sync(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    # Use target if specified, otherwise use the wiki's source
    target = a.input("target") or wiki.get("source")
    if not target:
        a.error(400, "No upstream wiki to sync from")
        return

    # Request sync from target
    dump = mochi.remote.request(target, "wikis", "sync", {})
    if dump.get("error") or not dump:
        a.error(500, "Failed to receive sync data")
        return

    # Import the dump (includes attachments with remote entity reference)
    if not import_sync_dump(wiki["id"], dump):
        a.error(500, "Failed to import sync data")
        return

    # Subscribe to the source wiki for future updates
    mochi.message.send(
        {"from": wiki["id"], "to": target, "service": "wikis", "event": "subscribe"},
        {"name": wiki.get("name") or ""}
    )

    return {"data": {"ok": True, "message": "Sync completed successfully"}}

# ATTACHMENTS

# List all wiki attachments
def action_attachments(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error(403, "Access denied")
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

    if not check_access(a, wiki["id"], "edit"):
        a.error(403, "Access denied")
        return

    # If this is a subscriber wiki, save locally then notify source asynchronously
    source = wiki.get("source")
    if source:
        # Save attachment locally first (immediately available)
        attachments = mochi.attachment.save(wiki["id"], "files", [], [], [])
        if not attachments:
            a.error(400, "No files uploaded")
            return

        # Notify source wiki asynchronously for each attachment
        # Source will fetch the file data from us via stream
        for att in attachments:
            mochi.message.send(
                {"from": wiki["id"], "to": source, "service": "wikis", "event": "attachment/create"},
                {
                    "id": att["id"],
                    "name": att["name"],
                    "size": att["size"],
                    "content_type": att.get("type") or att.get("content_type", ""),
                    "created": att["created"],
                    "subscriber": wiki["id"],  # So source knows where to fetch from
                }
            )

        return {"data": {"attachments": attachments}}

    # Get subscribers for notification
    subscribers = mochi.db.rows("select id from subscribers where wiki=? and id!=?", wiki["id"], wiki["id"])

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

    wiki = get_wiki(a)
    if not wiki:
        a.error(404, "Wiki not found")
        return

    if not check_access(a, wiki["id"], "delete"):
        a.error(403, "Access denied")
        return

    id = a.input("id")
    if not id:
        a.error(400, "Attachment ID is required")
        return

    source = wiki.get("source")

    # Delete locally - subscriber doesn't notify others (source will broadcast)
    if source:
        notify = []
    else:
        subscribers = mochi.db.rows("select id from subscribers where wiki=? and id!=?", wiki["id"], wiki["id"])
        notify = [s["id"] for s in subscribers]

    if not mochi.attachment.delete(id, notify):
        a.error(404, "Attachment not found")
        return

    # Remove references to this attachment from all pages
    ref = "attachments/" + id
    pages = mochi.db.rows("select id, page, title, content, version from pages where wiki=? and content like ?", wiki["id"], "%" + ref + "%")
    now = mochi.time.now()
    author = a.user.identity.id
    name = a.user.identity.name

    for page in pages:
        new_content = remove_attachment_refs(page["content"], id)
        if new_content != page["content"]:
            # Use atomic version increment to prevent race conditions
            mochi.db.execute("update pages set content=?, author=?, updated=?, version=version+1 where id=?",
                new_content, author, now, page["id"])
            version = mochi.db.row("select version from pages where id=?", page["id"])["version"]
            create_revision(page["id"], page["title"], new_content, author, name, version, "Removed deleted attachment")
            # Notify: source broadcasts to subscribers, subscriber notifies source
            event_data = {
                "id": page["id"],
                "page": page["page"],
                "title": page["title"],
                "content": new_content,
                "author": author,
                "name": name,
                "updated": now,
                "version": version
            }
            if source:
                mochi.message.send(
                    {"from": wiki["id"], "to": source, "service": "wikis", "event": "page/update"},
                    event_data
                )
            else:
                broadcast_event(wiki["id"], "page/update", event_data)

    # Notify source of attachment deletion (if subscriber)
    if source:
        mochi.message.send(
            {"from": wiki["id"], "to": source, "service": "wikis", "event": "attachment/delete"},
            {"id": id}
        )

    return {"data": {"ok": True}}

# CROSS-APP PROXY ACTIONS

# Proxy user search to people app
def action_users_search(a):
    if not a.user:
        a.error(401, "Not logged in")
        return
    query = a.input("query", "")
    results = mochi.service.call("people", "users/search", query)
    return {"data": {"results": results}}

# Proxy groups list to people app
def action_groups(a):
    if not a.user:
        a.error(401, "Not logged in")
        return
    groups = mochi.service.call("people", "groups/list")
    return {"data": {"groups": groups}}

# Generate Open Graph meta tags for wiki pages
def opengraph_wiki(params):
    wiki_id = params.get("entity", "") or params.get("wiki", "")
    page_slug = params.get("page", "")

    # Default values
    og = {
        "title": "Wiki",
        "description": "A wiki on Mochi",
        "type": "website"
    }

    # Look up wiki
    if not wiki_id:
        return og

    wiki = mochi.db.row("select * from wikis where id=?", wiki_id)
    if not wiki:
        return og

    og["title"] = wiki["name"]
    og["description"] = wiki["name"] + " - Wiki"

    # If specific page requested, use page content
    if page_slug:
        page = mochi.db.row("select * from pages where wiki=? and page=? and deleted=0", wiki["id"], page_slug)
        if page:
            og["type"] = "article"
            og["title"] = page["title"] + " - " + wiki["name"]

            # Use first 200 chars of content as description, stripping markdown
            content = page.get("content", "")
            if content:
                # Simple markdown stripping: remove common markdown syntax
                desc = content
                # Remove headers
                lines = []
                for line in desc.split("\n"):
                    if not line.startswith("#"):
                        lines.append(line)
                desc = " ".join(lines)
                # Remove links [text](url) -> text
                while "[" in desc and "](" in desc:
                    start = desc.find("[")
                    mid = desc.find("](", start)
                    end = desc.find(")", mid)
                    if start >= 0 and mid > start and end > mid:
                        link_text = desc[start+1:mid]
                        desc = desc[:start] + link_text + desc[end+1:]
                    else:
                        break
                # Remove bold/italic markers
                desc = desc.replace("**", "").replace("__", "").replace("*", "").replace("_", "")
                # Remove code blocks
                desc = desc.replace("`", "")
                # Collapse whitespace
                desc = " ".join(desc.split())
                # Truncate
                if len(desc) > 200:
                    desc = desc[:197] + "..."
                if desc:
                    og["description"] = desc

    return og
