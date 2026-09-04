# Mochi wiki app
# Copyright © 2026 Mochisoft OÜ
# SPDX-License-Identifier: AGPL-3.0-only
# This file is part of Mochi, licensed under the GNU AGPL v3 with the
# Mochi Application Interface Exception - see license.txt and license-exception.md.

# remote_error: a core transport failure (marked "transport") becomes a
# translated generic error with the detail logged; a far-end app answer passes
# through. notify: the topic header label is
# `notifications.topic.<topic-with-dots>` in labels/<lang>.conf, mirroring
# forums.
def remote_error(a, response, code=502):
    if response.get("transport"):
        mochi.log.info("Remote transport error: %s", response.get("error", ""))
        a.error.label(response.get("code", code), "errors.remote")
    else:
        # The remote sends a stable label key; localise it in the caller's language.
        a.error.label(response.get("code", code), response.get("error", "errors.remote"))

def notify(topic, object="", title="", body="", url="", name="", event_id=""):
    mochi.service.call("notifications", "send", topic, object, title, body, url, mochi.app.label("notifications.topic." + topic.replace("/", ".")), name, "", None, event_id)

# Database creation

def database_create():
    # Wikis table - source is the upstream wiki entity ID for joined wikis, server is the remote server URL
    mochi.db.execute("create table if not exists wikis (id text primary key, name text not null, home text not null default 'home', source text not null default '', server text not null default '', created integer not null, synced integer not null default 0)")

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

    # Replicas table - downstream wikis that replicate from this wiki
    # identity: the person whose view access the fan-out checks, proved by
    # signature at registration. The id column is the replica ENTITY, which is
    # only ever an address - no access rule ever names it.
    mochi.db.execute("create table if not exists replicas (wiki text not null references wikis(id), id text not null, name text not null default '', identity text not null default '', subscribed integer not null, seen integer not null default 0, synced integer not null default 0, primary key (wiki, id))")

    # origin: the replica that submitted the comment over P2P ('' when local) -
    # the key for remote edit/delete. signature: the author's ed25519 signature;
    # origin proves which replica sent it, only this proves who wrote it. See
    # comment_create_payload.
    mochi.db.execute("create table if not exists comments (id text primary key, wiki text not null references wikis(id), page text not null, parent text not null default '', author text not null, name text not null default '', body text not null, created integer not null, edited integer not null default 0, deleted integer not null default 0, origin text not null default '', signature text not null default '')")
    mochi.db.execute("create index if not exists comments_wiki on comments(wiki)")
    mochi.db.execute("create index if not exists comments_page on comments(page)")
    mochi.db.execute("create index if not exists comments_parent on comments(parent)")
    mochi.db.execute("create index if not exists comments_created on comments(created)")

    # RSS tokens: only the SHA256 is stored (the digest core keeps), so a leaked
    # backup holds no working feed credential.
    mochi.db.execute("create table if not exists rss (hash text not null primary key, entity text not null, mode text not null, created integer not null, unique(entity, mode))")

    # Outbound-request throttle. Core rate-limits inbound P2P and outbound HTTP
    # but not outbound mochi.remote.request, so the app has to bound its own.
    mochi.db.execute("create table if not exists throttle (key text not null primary key, last integer not null)")

    # Attachments now live in this database, owned by the shared library, rather
    # than in core's managed store.
    attachment_schema_create()

def database_upgrade(version):
    # Schema 2: drop replicas.peer - the core per-user directory carries the
    # route (#209, #220).
    if version == 2:
        for c in mochi.db.table("replicas"):
            if c["name"] == "peer":
                mochi.db.execute("alter table replicas drop column peer")
                break
    # Schema 3: drop the broadcast tables left behind when broadcast state moved
    # to the per-app system DB.
    if version == 3:
        for table in ["sequence", "log", "acknowledged", "received"]:
            mochi.db.execute("drop table if exists " + table)
    # Schema 4: comments.origin confines remote edit/delete to the submitting
    # replica. Existing rows default to '' and are therefore remotely immutable.
    if version == 4:
        found = False
        for c in mochi.db.table("comments"):
            if c["name"] == "origin":
                found = True
                break
        if not found:
            mochi.db.execute("alter table comments add column origin text not null default ''")
    # Schema 5: outbound-request throttle table (see throttled()).
    if version == 5:
        mochi.db.execute("create table if not exists throttle (key text not null primary key, last integer not null)")
    # Schema 6: rss stores the token's SHA256 rather than the token. Existing
    # rows are migrated by hashing what they hold, so every feed URL already in
    # a reader keeps working - the plaintext simply stops being retained.
    if version == 6:
        rows = mochi.db.rows("select token, entity, mode, created from rss") or []
        mochi.db.execute("drop table if exists rss")
        mochi.db.execute("create table if not exists rss (hash text not null primary key, entity text not null, mode text not null, created integer not null, unique(entity, mode))")
        for r in rows:
            mochi.db.execute("insert or ignore into rss (hash, entity, mode, created) values (?, ?, ?, ?)",
                mochi.crypto.hash.sha256(r["token"]), r["entity"], r["mode"], r["created"])
    # Schema 7: comments.signature, the author's own signature (see
    # comment_create_payload). Existing rows stay '' - their authorship cannot
    # be established after the fact; only inbound events require it.
    if version == 7:
        found = False
        for c in mochi.db.table("comments"):
            if c["name"] == "signature":
                found = True
                break
        if not found:
            mochi.db.execute("alter table comments add column signature text not null default ''")
    # Schema 8: attachments move into this database under the shared library;
    # existing rows come from core's transition bridge while one exists, else
    # from the export file core wrote before dropping its table.
    if version == 8 or version == 9 or version == 10:
    	# 9 and 10 re-run the step: a library installed ahead of its core update
    	# consumed those numbers without creating the table. The step is
    	# idempotent.
        attachment_schema_create()
        attachment_migrate()
    # Schema 11: the unreplicate retry is gone, and `unreplicated` existed only
    # to feed it. Nothing reads the table now, so drop it rather than leave it
    # accumulating rows on every unsubscribe.
    if version == 11:
        mochi.db.execute("drop table if exists unreplicated")
    # Schema 12: replicas.identity carries the person whose view access the
    # fan-out checks. Existing rows stay '' and keep falling back to the entity
    # until the replica re-registers with a signed identity.
    if version == 12:
        found = False
        for c in mochi.db.table("replicas"):
            if c["name"] == "identity":
                found = True
                break
        if not found:
            mochi.db.execute("alter table replicas add column identity text not null default ''")

# Has this outbound operation run within `seconds`? Records the attempt when
# not. Core rate-limits inbound P2P and outbound HTTP but not outbound
# mochi.remote.request, so the app bounds itself.
def throttled(key, seconds):
    now = mochi.time.now()
    row = mochi.db.row("select last from throttle where key=?", key)
    if row and now - row["last"] < seconds:
        return True
    mochi.db.execute("delete from throttle where last < ?", now - 3600)
    mochi.db.execute("replace into throttle (key, last) values (?, ?)", key, now)
    return False

# Wraps throttled() for the actions that reach a named wiki: both the shared
# outbound budget and the per-target one must allow the call.
def outbound_throttled(operation, target):
    if throttled("outbound", 2):
        return True
    return throttled(operation + ":" + (target or ""), 10)

def update_replica_seen(wiki, replica_id):
    now = mochi.time.now()
    mochi.db.execute("update replicas set seen=?, synced=? where wiki=? and id=?", now, now, wiki, replica_id)

# Helper: Get wiki from request, validating it exists
def get_wiki(a):
    wiki = a.input("wiki")
    if not wiki:
        return None
    return mochi.db.row("select * from wikis where id=?", wiki)

# Access levels, lowest first; each includes those below it and "edit" includes
# delete. "none" stores deny rules for every level; "manage" is separate and
# never grantable here (owner only).
ACCESS_LEVELS = ["view", "edit"]

# Read a text field from a peer-supplied payload. A non-string returns
# `fallback` so the caller's `if not x: return` rejects it; calling len() or
# .lower() on it would abort the whole handler instead.
# Ceiling on replicas per wiki. Generous enough that no real subscriber base
# reaches it, low enough that the row count cannot be driven to the database's
# page cap by an attacker minting sender entities.
REPLICAS_MAXIMUM = 10000


# Helper: Check if current user has access to perform an operation
# Uses hierarchical access levels: edit grants view, view is base level.
# Users with "manage" or "*" permission automatically have all permissions.
# The "delete" operation is treated as "edit" (edit includes delete).
def check_access(a, wiki_id, operation):
    resource = "wiki/" + wiki_id
    user = None
    if a.user and a.user.identity:
        user = a.user.identity.id

    # Owner has full access. Gate on a real authenticated user: mochi.entity.get
    # keys on the thread-local effective user, which for an anonymous request to a
    # public action is the entity owner. Without the `user and` guard an anonymous
    # caller is treated as the owner and bypasses the access rules below.
    if user and mochi.entity.get(wiki_id):
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
def check_event_access(user_id, wiki_id, operation):
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
# Returns True if valid, False otherwise. Updates replica seen timestamp if valid.
def validate_event_sender(wikirow, wiki, sender):
    source = wikirow.get("source")
    if source:
        # Replica wiki: only accept from our source
        return sender == source
    # Source wiki: only accept from registered replicas
    if not mochi.db.exists("select 1 from replicas where wiki=? and id=?", wiki, sender):
        return False
    update_replica_seen(wiki, sender)
    return True

# Authorise a replica-originated mutation. validate_event_sender proves only
# that the sender is a registered replica; on the source it must also hold
# `operation` access. Source -> replica is always allowed.
def replica_can(wikirow, wiki, sender, operation):
    # access-ok: source -> replica propagation; validate_event_sender already
    # proved sender == our recorded source.
    if wikirow.get("source"):
        return True
    return check_event_access(sender, wiki, operation)

# error_message_timeout: core calls this when a fan-out to a replica aged out
# undelivered. Remove them only when the directory shows no host left
# (locations == 0) - definitely gone, not a transient outage or a server
# migration in progress.
def error_message_timeout(e):
    if e.detail.get("locations", 1) != 0:
        return
    mochi.db.execute("delete from replicas where id=?", e.entity)

# error_subscriber_unreachable: core suspended this replica - every delivery
# across the whole evict window failed with no contradicting success - and
# asks us to drop them so fan-out stops paying for a dead host. If they
# return, they re-replicate.
def error_subscriber_unreachable(e):
    mochi.db.execute("delete from replicas where id=?", e.entity)

# error_broadcast_gap: core calls this when an unfillable broadcast gap was
# skipped and events were permanently lost. broadcast/resync can't replay a
# pruned gap, so pull a fresh full snapshot.
def error_broadcast_gap(e):
    request_resync(e.entity)


# idle_resync_age: how long without applying any broadcast from a replica's
# source wiki before the next view re-registers as a replica (the source may
# have pruned us after a long idle). Matches core's broadcast_log_age.
idle_resync_age = 7 * 86400

# Pull a fresh sync dump from the source when an event references a page or
# comment we have not seen; import_sync_dump applies it idempotently.
def request_resync(wiki_id):
    """Returns True iff a fresh sync dump was actually fetched and applied."""
    row = mochi.db.row("select source, server, synced from wikis where id=?", wiki_id)
    if not row or not row["source"]:
        return False
    now = mochi.time.now()
    if row["synced"] and now - row["synced"] < 60:
        return False
    mochi.db.execute("update wikis set synced=? where id=?", now, wiki_id)
    peer = None
    if row["server"]:
        peer = mochi.remote.peer(row["server"])
    # The reply is attacker-controlled: a scalar or null raises on .get and
    # aborts whichever handler triggered the resync.
    dump = mochi.remote.request(row["source"], "wikis", "sync", {}, peer)
    if not dump or type(dump) != "dict" or dump.get("status") != "200":
        return False
    import_sync_dump(wiki_id, dump)
    mochi.broadcast.touch(row["source"])
    fp = mochi.entity.fingerprint(wiki_id)
    if fp:
        mochi.websocket.write(fp, {"type": "wiki/resynced", "wiki": wiki_id})
    return True

# Deliver a replicate/unreplicate to a source that may no longer resolve
# (private entities never list; public entries expire offline). A stored
# "p2p/<peer>" server pins the queue row to that peer so the send parks until it
# reconnects; hostname servers route via the directory - resolving here would
# dial on a view path.
def registration_send(server, headers, content):
    peer = server[len("p2p/"):] if server and server.startswith("p2p/") else ""
    if peer:
        mochi.message.send.peer(peer, headers, content)
    else:
        mochi.message.send(headers, content)

# Re-register with the source when the subscription has gone idle
# (idle_resync_age): event_replicate is idempotent and pushes a sync dump.
# touch() is keyed by source, so a dead source is poked once per window.
def maybe_resubscribe(a, wiki_id):
    user_id = a.user.identity.id if a.user else None
    if not user_id:
        return
    row = mochi.db.row("select source, name, server from wikis where id=?", wiki_id)
    if not row or not row["source"]:
        return
    source = row["source"]
    if mochi.time.now() - mochi.broadcast.seen(source) <= idle_resync_age:
        return
    registration_send(row["server"],
        {"from": wiki_id, "to": source, "service": "wikis", "event": "replicate"},
        replicate_content(row["name"], wiki_id, source, user_id))
    mochi.broadcast.touch(source)

# Helper: Broadcast event to all replicas of a wiki via the durable
# broadcast log. Sequence + log + gap-detection live in core. Replicas
# whose view access has been revoked are filtered out client-side
# before handing the recipient list to mochi.broadcast.send.
def broadcast_event(wiki, event, data, exclude=None):
    if not wiki:
        return
    resource = "wiki/" + wiki
    replicas = mochi.db.rows("select id, identity from replicas where wiki=?", wiki)
    recipients = []
    for r in replicas:
        # The replica entity is an address, never the subject of an access rule:
        # grants go to person identities and to the * / + wildcards. Check the
        # identity the replica proved when it registered; a row predating that
        # binding falls back to the entity, which only a public wiki's wildcard
        # can satisfy - which is exactly how private wikis lost their fan-out.
        if not mochi.access.check(r["identity"] or r["id"], resource, "view"):
            continue
        # A replica is a private entity on the subscriber's server, not
        # directory-listed; the core per-user directory carries the route
        # (learned when the replica registered), so no app-level peer pin.
        recipients.append(r["id"])
    mochi.broadcast.send(wiki, wiki, recipients, "wikis", event, data, exclude or "")

# Tell any open wiki UI that content changed; keyed by the wiki's fingerprint,
# matching the web's websocket key. Distinct from notify(), which sends
# push/email.
def notify_websocket(wiki):
    if not wiki:
        return
    fp = mochi.entity.fingerprint(wiki)
    if fp:
        mochi.websocket.write(fp, {"type": "wiki/update", "wiki": wiki})

# Helper: Remove attachment references from content
def remove_attachment_references(content, attachment_id):
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

        # A line that held only the reference becomes blank rather than
        # disappearing - dropping it would merge the paragraphs either side.
        result.append(new_line if new_line.strip() else "")

    return "\n".join(result)

# Helper: Get page by slug, following redirects
def get_page(wiki, slug):
    # Check for redirect first
    redirect = mochi.db.row("select target from redirects where wiki=? and source=?", wiki, slug)
    if redirect:
        slug = redirect["target"]

    page = mochi.db.row("select * from pages where wiki=? and page=? and deleted=0", wiki, slug)
    return page

# Most internal links one page's missing-link check considers; beyond this the
# highlighting is truncated rather than costing an anonymous reader a worker.
WIKI_LINKS_MAXIMUM = 500

# Helper: Extract internal wiki links from markdown content
def extract_wiki_links(content):
    links = []
    # Membership is a dict, not `url not in links`: that scan is linear, so
    # deduping n links costs n^2 comparisons, and n is attacker-chosen.
    seen = {}
    i = 0
    while i < len(content):
        # Look for markdown link pattern: [text](url)
        if content[i] == '[':
            # Find closing bracket
            j = i + 1
            depth = 1
            while j < len(content) and depth > 0:
                if content[j] == '[':
                    depth += 1
                elif content[j] == ']':
                    depth -= 1
                j += 1
            # Check if followed by (url)
            if j < len(content) and content[j] == '(':
                k = j + 1
                while k < len(content) and content[k] != ')':
                    k += 1
                if k < len(content):
                    url = content[j+1:k]
                    # Skip external links and attachments
                    if not url.startswith("http://") and not url.startswith("https://") and not url.startswith("//"):
                        if not url.startswith("attachments/") and not url.startswith("-/attachments/") and "/-/attachments/" not in url:
                            # Clean up the URL (remove anchors, query strings)
                            if "#" in url:
                                url = url.split("#")[0]
                            if "?" in url:
                                url = url.split("?")[0]
                            if url and url not in seen:
                                seen[url] = True
                                links.append(url)
                                if len(links) >= WIKI_LINKS_MAXIMUM:
                                    return links
                    i = k
        i += 1
    return links

# Helper: Find which linked pages don't exist
def find_missing_links(wiki, content):
    links = extract_wiki_links(content)
    if not links:
        return []

    # Two queries for the whole page rather than two per link. This runs for
    # anonymous readers of a public wiki, so its cost is the reader's, and the
    # page that sets it is written by anyone with edit access.
    placeholders = ", ".join(["?" for link in links])
    present = {}
    for row in mochi.db.rows(
        "select page from pages where wiki=? and deleted=0 and page in (" + placeholders + ")",
        wiki, *links,
    ) or []:
        present[row["page"]] = True
    for row in mochi.db.rows(
        "select source from redirects where wiki=? and source in (" + placeholders + ")",
        wiki, *links,
    ) or []:
        present[row["source"]] = True

    missing = []
    for link in links:
        if link not in present:
            missing.append(link)
    return missing

# Names a page may not take: the client would route them to one of its own
# screens. The list is owned by the web router plus the server's files routes
# (assets, images), not by app.json, and covers domain-entity routing where a
# bare /<page> sits beside every screen - do not trim it to the /<wiki>/<page>
# siblings.
reserved_pages = [
    "401", "403", "404", "500", "503",
    "assets", "changes", "find", "images", "join", "new",
    "redirects", "search", "settings", "tags",
]

# Helper: is this slug (or `home` value) safe to use as a page name?
# `home` may carry slashes, so only the first segment can shadow a route.
def slug_reserved(slug):
    if not slug:
        return False
    return slug.split("/")[0] in reserved_pages

# What is wrong with this slug, as a label key, or None. Every slug path, local
# action and remote event, goes through here: the charset rule is what stops a
# planted `../delete` collapsing into another route in the client's
# `pages/<slug>` request. Callers check emptiness; slug_reserved alone tolerates
# slashes for `home`.
def slug_problem(slug):
    if len(slug) > 100:
        return "errors.url_too_long"
    if slug.startswith("-"):
        return "errors.page_names_starting_with_are_reserved"
    for c in slug.elems():
        if not (c.isalnum() or c in "-_"):
            return "errors.page_url_can_only_contain_letters_numbers_hyphens_and_unders"
    if slug_reserved(slug):
        return "errors.page_name_reserved"
    return None

# What is wrong with this tag, as a label key, or None. Applied on the event
# path too: tags is keyed (page, tag), so every distinct unbounded value is
# another row. Callers check emptiness.
def tag_problem(tag):
    if len(tag) > 50:
        return "errors.tag_too_long_max_50_characters"
    for c in tag.elems():
        if not (c.isalnum() or c in "-_"):
            return "errors.invalid_tag"
    return None

# Does this global id already belong to a DIFFERENT wiki? Every wiki a user
# holds shares one database, so a sync dump could otherwise overwrite - and via
# event_sync read back - another wiki's rows. `handle` is the caller's open
# transaction: import_sync_dump's reads must see its own uncommitted writes.
def foreign_page(page_id, wiki_id, handle=None):
    if not page_id:
        return False
    query = "select wiki from pages where id=?"
    row = handle.row(query, page_id) if handle else mochi.db.row(query, page_id)
    return row != None and row["wiki"] != wiki_id

def foreign_comment(comment_id, wiki_id, handle=None):
    if not comment_id:
        return False
    query = "select wiki from comments where id=?"
    row = handle.row(query, comment_id) if handle else mochi.db.row(query, comment_id)
    return row != None and row["wiki"] != wiki_id

# True unless the page is one we hold for this wiki. Used for rows that hang off
# a page (revisions, tags): an unknown page id is refused outright, since the
# dump's own pages are imported first and anything still missing is either
# another wiki's or fabricated.
def page_outside_wiki(page_id, wiki_id, handle=None):
    if not page_id:
        return True
    query = "select 1 from pages where id=? and wiki=?"
    if handle:
        return not handle.exists(query, page_id, wiki_id)
    return not mochi.db.exists(query, page_id, wiki_id)

# P2P version fields are never type-checked by core. A non-integer stored in the
# column breaks every later comparison (Starlark refuses to order across types);
# the upper bound stops a page being pinned above all future edits.
def valid_version(value):
    return type(value) == "int" and value > 0 and value < 1000000000

# System revision comments are stored as a label key plus arguments so each
# reader and peer renders them in their own language; a user-supplied comment is
# plain text and passes through untouched.
def system_comment(key, **args):
    return json.encode({"key": key, "args": args})

def revision_comment(stored):
    if not stored or not stored.startswith("{"):
        return stored
    decoded = json.decode(stored, None)
    if type(decoded) != "dict" or not decoded.get("key"):
        return stored
    return mochi.app.label(decoded["key"], **decoded.get("args", {}))

def create_revision(page, title, content, author, name, version, comment):
    id = mochi.uid()
    now = mochi.time.now()
    mochi.db.execute("insert into revisions (id, page, content, title, author, name, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id, page, content, title, author, name, now, version, comment)
    return id

# Stream an entity's asset from its owning service via a Mochi stream.
# Location-transparent: mochi.remote.stream() loops back in-process when the
# entity lives on this server, or goes over P2P otherwise. Handles both binary
# assets (avatar/banner/favicon) and JSON assets (style/information).
def stream_asset(a, entity_id, service, asset):
    if not entity_id:
        a.error.label(404, "errors.asset_unavailable", asset=asset)
        return None
    s = mochi.remote.stream(entity_id, service, asset, {})
    if not s:
        a.error.label(404, "errors.asset_unavailable", asset=asset)
        return None
    header = s.read()
    if not header or header.get("status") != "200":
        a.error.label(404, "errors.asset_not_set", asset=asset)
        return None
    a.header("Cache-Control", "private, max-age=300")
    if "data" in header:
        return {"data": header["data"]}
    a.header("Content-Type", header.get("content_type", "application/octet-stream"))
    # Per-slot byte caps matching what the people app accepts on upload; the
    # route is public, so an uncapped stream could run indefinitely. Unknown
    # slots fall back to the largest cap.
    caps = {"avatar": 2 * 1024 * 1024, "banner": 10 * 1024 * 1024, "favicon": 64 * 1024}
    a.write.stream(s, maximum=caps.get(asset, 10 * 1024 * 1024))
    return None

_PERSON_ASSETS = ("avatar", "banner", "favicon", "style", "information")

# Proxy a comment author's person asset from the people service.
def action_comment_asset(a):
    asset = a.input("asset")
    if asset not in _PERSON_ASSETS:
        a.error.label(404, "errors.unknown_asset")
        return
    # The route is public, so gate it: without this, knowing a comment id let an
    # anonymous caller confirm that identity participated in a private wiki, and
    # the 200-vs-404 answer is itself an oracle for the id.
    wiki = get_wiki(a)
    if not wiki or not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return
    # Bind the comment to the route wiki so this can't resolve a comment (and
    # its author) in a wiki the URL doesn't name.
    row = mochi.db.row("select author from comments where id=? and wiki=?", a.input("comment"), wiki["id"])
    return stream_asset(a, row["author"] if row else "", "people", asset)

# Proxy a revision author's person asset from the people service.
def action_revision_asset(a):
    asset = a.input("asset")
    if asset not in _PERSON_ASSETS:
        a.error.label(404, "errors.unknown_asset")
        return
    # Public route - gate it before resolving anyone (see action_comment_asset).
    wiki = get_wiki(a)
    if not wiki or not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return
    # Bind the revision to the route wiki (via its page) so this can't resolve a
    # revision author in a wiki the URL doesn't name.
    row = mochi.db.row("select r.author from revisions r join pages p on r.page=p.id where r.id=? and p.wiki=?", a.input("revision"), wiki["id"])
    return stream_asset(a, row["author"] if row else "", "people", asset)

# ACTIONS

# Create a new wiki entity
def action_create(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    name = a.input("name")
    if not name or not mochi.text.valid(name, "name"):
        a.error.label(400, "errors.invalid_name")
        return
    if len(name) > 100:
        a.error.label(400, "errors.name_too_long")
        return

    privacy = a.input("privacy") or "public"
    if privacy not in ["public", "private"]:
        a.error.label(400, "errors.invalid_privacy_setting")
        return

    # Create entity for the wiki (returns entity ID string)
    entity = mochi.entity.create("wiki", name, privacy, "")
    if not entity:
        a.error.label(500, "errors.failed_to_create_wiki_entity")
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

    fingerprint = mochi.entity.fingerprint(entity)
    return {"data": {"id": entity, "name": name, "home": "home", "fingerprint": fingerprint}}

# Join an existing remote wiki by creating a local copy
# Produce a mochi://<server-peer>/<wiki> share link for a wiki the caller
# owns. The link conveys location only - a private wiki still requires view
# grants (the sync dump and the update fan-out are both access-gated) (#209).
def action_share(a): # wikis_share
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    wiki_id = a.input("wiki")
    if not mochi.text.valid(wiki_id, "entity"):
        a.error.label(400, "errors.wiki_id_is_required")
        return
    if not mochi.entity.get(wiki_id):  # gated on a.user above
        a.error.label(403, "errors.access_denied")
        return
    peer = mochi.server.id()
    return {"data": {"link": "mochi://" + peer + "/" + wiki_id, "peer": peer, "wiki": wiki_id}}

# Resolve a pasted mochi://<peer>/<wiki> share link to the wiki's name, so the
# find page can show the real wiki before joining (#209).
def action_probe(a): # wikis_probe
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    url = a.input("url", "")
    if not url.startswith("mochi://"):
        a.error.label(400, "errors.invalid_url")
        return
    rest = url[len("mochi://"):]
    if "/" not in rest:
        a.error.label(400, "errors.invalid_url")
        return
    link_peer, path = rest.split("/", 1)
    link_wiki = path.split("/")[0]
    if not link_peer or not mochi.text.valid(link_wiki, "entity"):
        a.error.label(400, "errors.invalid_url")
        return
    # The target comes from a pasted URL, so this is the easiest place to aim
    # this server's outbound traffic at an entity of the caller's choosing.
    if outbound_throttled("probe", link_wiki):
        a.error.label(429, "errors.too_many_requests")
        return
    response = mochi.remote.request(link_wiki, "wikis", "information", {"wiki": link_wiki}, link_peer)
    # link_peer/link_wiki come from a user-pasted URL, so a hostile peer can
    # answer with a non-dict; check before .get to avoid a raw-traceback 500.
    if not response or type(response) != "dict":
        a.error.label(502, "errors.unable_to_connect_to_server")
        return
    if response.get("error"):
        remote_error(a, response, 404)
        return
    return {"data": {
        "id": link_wiki,
        "name": response.get("name", ""),
        "fingerprint": response.get("fingerprint", ""),
        "class": "wiki",
        "peer": link_peer,  # join pins the same peer for the sync
        "remote": True
    }}

def action_join(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    # Get the remote wiki entity ID and optional server or peer
    source = a.input("target")
    server = a.input("server")
    peer = a.input("peer")  # from a mochi://<peer>/<wiki> share link
    if not source:
        a.error.label(400, "errors.target_wiki_entity_id_is_required")
        return
    if not mochi.text.valid(source, "entity"):
        a.error.label(400, "errors.invalid_target")
        return

    # Check if we already have a wiki tracking this source
    existing = mochi.db.row("select * from wikis where source=?", source)
    if existing:
        a.error.label(400, "errors.already_joined_this_wiki")
        return

    if outbound_throttled("join", source):
        a.error.label(429, "errors.too_many_requests")
        return

    # Connect via the share link's peer, the specified server, or directory lookup
    if not peer and server:
        peer = mochi.remote.peer(server)

    # Sync data from the remote wiki first to get the name
    dump = mochi.remote.request(source, "wikis", "sync", {}, peer)
    # source/peer are user-supplied; guard against a non-dict answer before .get.
    if not dump or type(dump) != "dict" or dump.get("error") or dump.get("status") != "200":
        # A refusal is the remote's answer, not a failure here: the sync dump is
        # view-gated, so an ungranted join arrives as 403 and must stay a 403.
        code = dump.get("code") if type(dump) == "dict" else None
        if code == 403 or code == "403":
            a.error.label(403, "errors.access_denied")
            return
        a.error.label(500, "errors.failed_to_sync_from_remote_wiki")
        return

    # Get the wiki name from the sync response. It is remote-authored and goes
    # straight into an entity name and the sidebar, so hold it to the same rule
    # action_rename applies locally.
    name = dump.get("name") or ""
    if not name or not mochi.text.valid(name, "name") or len(name) > 100:
        name = "Joined Wiki"

    # Create a new local entity for this wiki (private so it's not added to directory)
    entity = mochi.entity.create("wiki", name, "private", "")
    if not entity:
        a.error.label(500, "errors.failed_to_create_wiki_entity")
        return

    # Register wiki in the database with source and server tracking
    now = mochi.time.now()
    mochi.db.execute("insert into wikis (id, name, home, source, server, created) values (?, ?, ?, ?, ?, ?)",
        entity, name, dump.get("home") or "home", source, server or "", now)

    # Import the synced data into the new local wiki
    import_sync_dump(entity, dump)

    # Set up access rules. The wildcard grants only apply when the SOURCE wiki
    # is public - a private wiki's local replica must not become world-viewable
    # on the subscriber's server just because it was joined by link.
    creator = a.user.identity.id
    resource = "wiki/" + entity
    if dump.get("privacy", "public") == "public":
        mochi.access.allow("*", resource, "view", creator)
        mochi.access.allow("+", resource, "edit", creator)
    mochi.access.allow(creator, resource, "*", creator)

    # Register as a replica with the source wiki to receive updates. A private
    # source is not in the directory, so pin the peer we joined through.
    content = replicate_content(name, entity, source, creator)
    if peer:
        mochi.message.send.peer(peer,
            {"from": entity, "to": source, "service": "wikis", "event": "replicate"},
            content)
    else:
        mochi.message.send(
            {"from": entity, "to": source, "service": "wikis", "event": "replicate"},
            content
        )
    mochi.broadcast.touch(source)

    fingerprint = mochi.entity.fingerprint(entity)
    return {"data": {"id": entity, "name": name, "source": source, "fingerprint": fingerprint, "home": dump.get("home") or "home"}}

# Delete a wiki and all its data
def action_resync(a):
    """Force a fresh sync dump from the source wiki. The event handlers
    self-heal via request_resync on the next inbound event; this action
    lets the UI or a user trigger it explicitly."""
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return
    # Gate before answering: the wiki is addressed by the route, so without this
    # a stranger could force someone else's replica to pull and re-import, and
    # the source/no-source answer below would tell them which wikis are replicas.
    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
        return
    if not wiki.get("source"):
        # This wiki is itself the canonical source — nothing to resync from.
        return {"data": {"synced": False}}
    # Clearing `synced` below deliberately defeats request_resync's own 60
    # second gate, which is right for a user pressing Resync but leaves nothing
    # bounding how often they can press it.
    if outbound_throttled("resync", wiki["id"]):
        a.error.label(429, "errors.too_many_requests")
        return
    mochi.db.execute("update wikis set synced=0 where id=?", wiki["id"])
    synced = request_resync(wiki["id"])
    return {"data": {"synced": synced}}

# Revoke a wiki's RSS access tokens (the core tokens, not just the rss rows) so a
# removed wiki's ?token= URL stops authenticating. No-op when the wiki has no RSS
# tokens, so it is safe to call from every wiki-removal path.
def rss_tokens_revoke(entity_id):
    for r in mochi.db.rows("select hash from rss where entity=?", entity_id) or []:
        mochi.token.delete(r["hash"])
    mochi.db.execute("delete from rss where entity=?", entity_id)

# Remove a wiki's comments with their attachments. attachment_clear(wiki_id)
# does not reach these: a comment's attachments are keyed on the comment id, and
# the orphan sweep skips any file that still has a row.
def delete_wiki_comments(wiki_id):
    for row in mochi.db.rows("select id from comments where wiki=?", wiki_id) or []:
        for att in (attachment_list(row["id"], wiki_id) or []):
            attachment_delete(att["id"])
    mochi.db.execute("delete from comments where wiki=?", wiki_id)

def action_delete(a):
    if not a.user:
        a.error.label(401, "errors.authentication_required")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
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

    # 5. Delete comments, and the attachments they own
    delete_wiki_comments(wiki_id)

    # 6. Delete replicas
    mochi.db.execute("delete from replicas where wiki=?", wiki_id)

    # 7. Delete RSS tokens (core tokens too, not just the rss rows).
    rss_tokens_revoke(wiki_id)

    # 8. Delete wiki record
    mochi.db.execute("delete from wikis where id=?", wiki_id)

    # 9. Delete all attachments for this entity
    attachment_clear(wiki_id)

    # 10. Clear access rules
    mochi.access.clear.resource("wiki/" + wiki_id)

    # A replica tells its source to drop it. Must precede the entity delete: the
    # message is sent AS this entity, and the sender check and signature read
    # its key from the entities table.
    if wiki["source"]:
        registration_send(wiki["server"], {"from": wiki_id, "to": wiki["source"], "service": "wikis", "event": "unreplicate"}, {})

    # 11. Delete the entity from the entities table and directory
    mochi.entity.delete(wiki_id)

    return {"data": {"ok": True, "deleted": wiki_id}}

# Info endpoint for class context - returns list of wikis
def action_info_class(a):
    columns = """
        select w.id, w.name, w.home, w.source, w.created,
            (select count(*) from pages p where p.wiki=w.id and p.deleted=0) as pages,
            (select max(p.updated) from pages p where p.wiki=w.id and p.deleted=0) as updated
        from wikis w
    """
    if a.user and a.user.identity:
        # Logged-in owner sees all their wikis (owned + subscribed replicas)
        wikis_raw = mochi.db.rows(columns)
    else:
        # Anonymous callers run as the host owner, so list only locally-owned
        # wikis granting public view.
        # mochi.access.check(None, ...) directly - check_access() resolves the
        # thread-local owner and would pass.
        wikis_raw = mochi.db.rows(columns + " where w.source=''")
        wikis_raw = [w for w in wikis_raw if mochi.access.check(None, "wiki/" + w["id"], "view")]
    wikis = [dict(w, fingerprint=mochi.entity.fingerprint(w["id"])) for w in wikis_raw]
    return {"data": {"entity": False, "wikis": wikis}}

# Search directory for remote wikis
def action_directory_search(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    search = a.input("search", "").strip()
    if not search:
        return {"data": {"results": []}}

    results = []

    # Check if search term is an entity ID
    if mochi.text.valid(search, "entity"):
        entry = mochi.directory.get(search)
        if entry and entry.get("class") == "wiki":
            results.append(entry)

    # Check if search term is a fingerprint (with or without hyphens)
    fingerprint = search.replace("-", "")
    if mochi.text.valid(fingerprint, "fingerprint"):
        matches = mochi.directory.search("wiki", "", False, fingerprint=fingerprint)
        for entry in matches:
            found = False
            for r in results:
                if r.get("id") == entry.get("id"):
                    found = True
                    break
            if not found:
                results.append(entry)

    # Check if search term is a URL (e.g., https://example.com/wikis/ENTITY_ID or /wikis/FINGERPRINT)
    if search.startswith("http://") or search.startswith("https://"):
        url = search
        if "/wikis/" in url:
            parts = url.split("/wikis/", 1)
            wiki_path = parts[1]
            # Path format: /wikis/ENTITY_ID or /wikis/FINGERPRINT/page
            wiki_id = wiki_path.split("/")[0] if "/" in wiki_path else wiki_path
            if "?" in wiki_id:
                wiki_id = wiki_id.split("?")[0]
            if "#" in wiki_id:
                wiki_id = wiki_id.split("#")[0]

            # Try as entity ID first
            if mochi.text.valid(wiki_id, "entity"):
                entry = mochi.directory.get(wiki_id)
                if entry and entry.get("class") == "wiki":
                    found = False
                    for r in results:
                        if r.get("id") == entry.get("id"):
                            found = True
                            break
                    if not found:
                        results.append(entry)
            # Try as fingerprint
            elif mochi.text.valid(wiki_id, "fingerprint"):
                matches = mochi.directory.search("wiki", "", False, fingerprint=wiki_id.replace("-", ""))
                for entry in matches:
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

# Action: Get wiki recommendations
# Read the user's BCP 47 language tag, or "en" if unset / anonymous
def user_language(a):
    if not a.user:
        return "en"
    preference = a.user.preference.get("language")
    if not preference:
        return "en"
    return str(preference).strip().lower()

def action_recommendations(a):
    # Gather IDs of wikis the user already has (owned + subscribed)
    existing_ids = set()
    wikis = mochi.db.rows("select id, source from wikis")
    if wikis:
        for w in wikis:
            existing_ids.add(w["id"])
            if w["source"]:
                existing_ids.add(w["source"])

    # Request recommendations from the recommendations service
    s = mochi.remote.stream("1JYmMpQU7fxvTrwHpNpiwKCgUg3odWqX7s9t1cLswSMAro5M2P", "recommendations", "list", {"type": "wiki", "language": user_language(a)})
    if not s:
        return {"data": {"wikis": []}}

    r = s.read()
    if not r or r.get("status") != "200":
        s.close()
        return {"data": {"wikis": []}}

    recommendations = []
    items = s.read()
    if type(items) not in ["list", "tuple"]:
        s.close()
        return {"data": {"wikis": []}}

    # Get the server location from the recommendations entity so subscribers can reach the wikis
    rec_dir = mochi.directory.get("1JYmMpQU7fxvTrwHpNpiwKCgUg3odWqX7s9t1cLswSMAro5M2P")
    rec_server = ""
    if rec_dir:
        rec_server = rec_dir.get("location", "")

    for item in items:
        entity_id = item.get("entity", "")
        if entity_id and entity_id not in existing_ids:
            recommendations.append({
                "id": entity_id,
                "name": item.get("name", ""),
                "blurb": item.get("blurb", ""),
                "fingerprint": mochi.entity.fingerprint(entity_id),
                "server": rec_server,
            })
    s.close()
    return {"data": {"wikis": recommendations}}

# Info endpoint for entity context - returns wiki info
def action_info_entity(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return

    # Re-establish with the source if this replica has gone idle.
    maybe_resubscribe(a, wiki["id"])

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

    # Get fingerprint - with hyphens for display, without for URLs
    fp_url = mochi.entity.fingerprint(wiki["id"])
    fp = fp_url[:3] + "-" + fp_url[3:6] + "-" + fp_url[6:]

    # Add fingerprint to wiki object for URL generation
    wiki = dict(wiki, fingerprint=fp_url)

    # Also include all wikis for sidebar display
    # Add fingerprint (without hyphens) to each for shorter URLs
    columns = """
        select w.id, w.name, w.home, w.source, w.created,
            (select count(*) from pages p where p.wiki=w.id and p.deleted=0) as pages,
            (select max(p.updated) from pages p where p.wiki=w.id and p.deleted=0) as updated
        from wikis w
    """
    if a.user and a.user.identity:
        # Authenticated callers query their own database, so every row is
        # already one of their own wikis or replicas.
        wikis_raw = mochi.db.rows(columns)
    else:
        # Anonymous callers run as the entity owner, so list only locally-owned
        # wikis granting public view.
        # mochi.access.check(None, ...) directly, not check_access() - as in action_info_class.
        wikis_raw = mochi.db.rows(columns + " where w.source=''")
        wikis_raw = [w for w in wikis_raw if mochi.access.check(None, "wiki/" + w["id"], "view")]
    wikis = [dict(w, fingerprint=mochi.entity.fingerprint(w["id"])) for w in wikis_raw]

    return {"data": {"entity": True, "wiki": wiki, "wikis": wikis, "permissions": permissions, "fingerprint": fp}}

# View a page
def action_page(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return

    slug = a.input("page")
    if not slug:
        a.error.label(400, "errors.missing_page_parameter")
        return

    page = get_page(wiki["id"], slug)
    if not page:
        return {"data": {"error": "not_found", "page": slug}}

    # Get tags for this page
    tags = mochi.db.rows("select tag from tags where page=?", page["id"])
    taglist = [t["tag"] for t in tags]

    # Find links to non-existent pages (for red link styling)
    missing_links = find_missing_links(wiki["id"], page["content"])

    # Comment count for this page
    comment_count = page_comment_count(wiki["id"], slug)

    return {"data": {
        "comments": {"count": comment_count},
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
        },
        "links": {"missing": missing_links}
    }}

# Edit a page (create or update)
def action_page_edit(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    slug = a.input("page")
    if not slug:
        a.error.label(400, "errors.missing_page_parameter")
        return
    problem = slug_problem(slug)
    if problem:
        a.error.label(400, problem, name=slug)
        return

    title = a.input("title")
    content = a.input("content")
    comment = a.input("comment", "")

    if not title:
        a.error.label(400, "errors.title_is_required")
        return
    if len(title) > 255:
        a.error.label(400, "errors.title_too_long_max_255_characters")
        return

    if content == None:
        content = ""
    if len(content) > 1000000:
        a.error.label(400, "errors.content_too_long_max_1mb")
        return

    if len(comment) > 500:
        a.error.label(400, "errors.comment_too_long_max_500_characters")
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
            # Notify: source broadcasts to replicas, replica notifies source
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
            # Notify: source broadcasts to replicas, replica notifies source
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
        # Notify: source broadcasts to replicas, replica notifies source
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
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    slug = a.input("slug")
    title = a.input("title")
    content = a.input("content", "")

    if not slug:
        a.error.label(400, "errors.slug_is_required")
        return
    problem = slug_problem(slug)
    if problem:
        a.error.label(400, problem, name=slug)
        return

    if not title:
        a.error.label(400, "errors.title_is_required")
        return
    if len(title) > 255:
        a.error.label(400, "errors.title_too_long_max_255_characters")
        return

    if len(content) > 1000000:
        a.error.label(400, "errors.content_too_long_max_1mb")
        return

    author = a.user.identity.id
    name = a.user.identity.name
    source = wiki.get("source")

    # Check if page already exists
    existing = mochi.db.row("select id, deleted, version from pages where wiki=? and page=?", wiki["id"], slug)
    if existing and not existing["deleted"]:
        a.error.label(409, "errors.page_already_exists")
        return

    # Create or restore the page
    now = mochi.time.now()

    if existing and existing["deleted"]:
        # Restore deleted page with new content
        id = existing["id"]
        version = existing["version"] + 1
        mochi.db.execute("update pages set title=?, content=?, author=?, updated=?, version=?, deleted=0 where id=?",
            title, content, author, now, version, id)
        create_revision(id, title, content, author, name, version, system_comment("revisions.restored"))
    else:
        # Create new page
        id = mochi.uid()
        version = 1
        mochi.db.execute("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, 1)",
            id, wiki["id"], slug, title, content, author, now, now)
        create_revision(id, title, content, author, name, 1, system_comment("revisions.created"))

    # Notify: source broadcasts to replicas, replica notifies source
    event_data = {
        "id": id,
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

    return {"data": {"id": id, "slug": slug}}

# Whether a revision version parameter is usable. mochi.text.valid admits a
# leading sign, which int() accepts and the revision lookup would then miss
# silently, so exclude it here rather than relying on the query finding no row.
def version_valid(value):
    return value and mochi.text.valid(value, "integer") and not value.startswith("-")

# Parse and clamp limit/offset query parameters for paginated list actions
def pagination(a, default_limit=50):
    limit_input = a.input("limit")
    offset_input = a.input("offset")
    # isdigit() is not a safe guard for int(): it accepts Unicode digit forms
    # (Arabic-Indic, Devanagari) that int() then rejects, aborting the action
    # as a 500. The clamps below cover the sign this check admits.
    limit = int(limit_input) if limit_input != None and mochi.text.valid(str(limit_input), "integer") else default_limit
    offset = int(offset_input) if offset_input != None and mochi.text.valid(str(offset_input), "integer") else 0
    return min(max(limit, 1), 200), max(offset, 0)

# Page history
def action_page_history(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return

    slug = a.input("page")
    if not slug:
        a.error.label(400, "errors.missing_page_parameter")
        return

    page = mochi.db.row("select * from pages where wiki=? and page=? and deleted=0", wiki["id"], slug)
    if not page:
        a.error.label(404, "errors.page_not_found")
        return

    limit, offset = pagination(a)

    total_row = mochi.db.row("select count(*) as cnt from revisions where page=?", page["id"])
    total = total_row["cnt"] if total_row else 0
    revisions = mochi.db.rows("select id, title, author, name, created, version, comment from revisions where page=? order by version desc limit ? offset ?", page["id"], limit, offset)
    for r in revisions:
        r["comment"] = revision_comment(r["comment"])

    # Resolve author names - use stored name if available, else try to resolve
    for rev in revisions:
        if not rev["name"]:
            rev["name"] = mochi.entity.name(rev["author"]) or ""

    return {"data": {"page": slug, "revisions": revisions, "total": total, "limit": limit, "offset": offset}}

# View a specific revision
def action_page_revision(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return

    slug = a.input("page")
    version = a.input("version")

    if not slug:
        a.error.label(400, "errors.missing_page_parameter")
        return

    if not version_valid(version):
        a.error.label(400, "errors.missing_version_parameter")
        return

    page = mochi.db.row("select * from pages where wiki=? and page=? and deleted=0", wiki["id"], slug)
    if not page:
        a.error.label(404, "errors.page_not_found")
        return

    revision = mochi.db.row("select * from revisions where page=? and version=?", page["id"], int(version))
    if not revision:
        a.error.label(404, "errors.revision_not_found")
        return

    # Resolve author name from stored value or entity lookup
    stored_name = revision["name"] if revision["name"] else None
    resolved_name = stored_name or mochi.entity.name(revision["author"]) or ""

    return {"data": {
        "page": slug,
        "revision": {
            "id": revision["id"],
            "title": revision["title"],
            "content": revision["content"],
            "author": revision["author"],
            "name": resolved_name,
            "created": revision["created"],
            "version": revision["version"],
            "comment": revision_comment(revision["comment"])
        },
        "version": {"current": page["version"]}
    }}

# Revert to a previous revision
def action_page_revert(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    slug = a.input("page")
    version = a.input("version")
    comment = a.input("comment", "")

    if not slug:
        a.error.label(400, "errors.missing_page_parameter")
        return

    if not version_valid(version):
        a.error.label(400, "errors.version_is_required")
        return

    source = wiki.get("source")

    page = mochi.db.row("select * from pages where wiki=? and page=?", wiki["id"], slug)
    if not page:
        a.error.label(404, "errors.page_not_found")
        return

    revision = mochi.db.row("select * from revisions where page=? and version=?", page["id"], int(version))
    if not revision:
        a.error.label(404, "errors.revision_not_found")
        return

    # Create new version with content from old revision
    now = mochi.time.now()
    author = a.user.identity.id
    name = a.user.identity.name
    newversion = page["version"] + 1

    if not comment:
        comment = system_comment("revisions.reverted", version=version)

    mochi.db.execute("update pages set title=?, content=?, author=?, updated=?, version=?, deleted=0 where id=?",
        revision["title"], revision["content"], author, now, newversion, page["id"])
    create_revision(page["id"], revision["title"], revision["content"], author, name, newversion, comment)

    # Notify: source broadcasts to replicas, replica notifies source
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

    return {"data": {"slug": slug, "version": newversion, "reverted": {"from": int(version)}}}

# Delete a page (soft delete)
def action_page_delete(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "delete"):
        a.error.label(403, "errors.access_denied")
        return

    slug = a.input("page")
    if not slug:
        a.error.label(400, "errors.missing_page_parameter")
        return

    source = wiki.get("source")

    page = mochi.db.row("select * from pages where wiki=? and page=? and deleted=0", wiki["id"], slug)
    if not page:
        a.error.label(404, "errors.page_not_found")
        return

    now = mochi.time.now()
    version = page["version"] + 1

    mochi.db.execute("update pages set deleted=?, version=? where id=?", now, version, page["id"])

    # Notify: source broadcasts to replicas, replica notifies source
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
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    old_slug = a.input("page")
    new_slug = a.input("slug")
    rename_children = a.input("children", "true") == "true"
    create_redirects = a.input("redirects", "false") == "true"

    if not old_slug:
        a.error.label(400, "errors.missing_page_parameter")
        return

    if not new_slug:
        a.error.label(400, "errors.new_slug_is_required")
        return

    # Validate new slug
    problem = slug_problem(new_slug)
    if problem:
        a.error.label(400, problem, name=new_slug)
        return

    # Can't rename to itself
    if old_slug == new_slug:
        a.error.label(400, "errors.slug_unchanged")
        return

    source = wiki.get("source")
    author = a.user.identity.id
    name = a.user.identity.name
    now = mochi.time.now()

    # Get the page to rename
    page = mochi.db.row("select * from pages where wiki=? and page=? and deleted=0", wiki["id"], old_slug)
    if not page:
        a.error.label(404, "errors.page_not_found")
        return

    # Check new slug doesn't already exist
    existing = mochi.db.row("select 1 from pages where wiki=? and page=? and deleted=0", wiki["id"], new_slug)
    if existing:
        a.error.label(400, "errors.a_page_with_this_slug_already_exists")
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
                a.error.label(400, "errors.page_with_slug_already_exists", slug=child_new_slug)
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
        create_revision(p["id"], p["title"], p["content"], author, name, new_version, system_comment("revisions.renamed", old=o))
        renamed.append({"old": o, "new": n})

        # Create redirect if requested
        if create_redirects:
            mochi.db.execute("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki["id"], o, n, now)
            redirect_data = {"source": o, "target": n, "created": now}
            if source:
                mochi.message.send(
                    {"from": wiki["id"], "to": source, "service": "wikis", "event": "redirect/set"},
                    redirect_data
                )
            else:
                broadcast_event(wiki["id"], "redirect/set", redirect_data)

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
                create_revision(p["id"], p["title"], new_content, author, name, new_version, system_comment("revisions.links", old=old, new=new))
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

    return {"data": {"renamed": renamed, "links": {"updated": updated_links}}}

# Add a tag to a page
def action_tag_add(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    slug = a.input("page")
    tag = a.input("tag")

    if not slug:
        a.error.label(400, "errors.missing_page_parameter")
        return

    if not tag:
        a.error.label(400, "errors.tag_is_required")
        return

    # Normalize tag (lowercase, trim)
    tag = tag.lower().strip()
    if not tag:
        a.error.label(400, "errors.tag_is_required")
        return
    problem = tag_problem(tag)
    if problem:
        a.error.label(400, problem)
        return

    page = mochi.db.row("select id from pages where wiki=? and page=? and deleted=0", wiki["id"], slug)
    if not page:
        a.error.label(404, "errors.page_not_found")
        return

    # Check if tag already exists
    existing = mochi.db.row("select 1 from tags where page=? and tag=?", page["id"], tag)
    if existing:
        return {"data": {"ok": True, "added": False}}

    mochi.db.execute("insert into tags (page, tag) values (?, ?)", page["id"], tag)

    # Send tag/add event: replica notifies source, owner broadcasts to replicas
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
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    slug = a.input("page")
    tag = a.input("tag")

    if not slug:
        a.error.label(400, "errors.missing_page_parameter")
        return

    if not tag:
        a.error.label(400, "errors.tag_is_required")
        return

    tag = tag.lower().strip()

    page = mochi.db.row("select id from pages where wiki=? and page=? and deleted=0", wiki["id"], slug)
    if not page:
        a.error.label(404, "errors.page_not_found")
        return

    mochi.db.execute("delete from tags where page=? and tag=?", page["id"], tag)

    # Send tag/remove event: replica notifies source, owner broadcasts to replicas
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
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
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
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return

    tag = a.input("tag")

    if not tag:
        a.error.label(400, "errors.missing_tag_parameter")
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
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return

    limit, offset = pagination(a)

    total_row = mochi.db.row("select count(*) as cnt from revisions r join pages p on p.id=r.page where p.wiki=? and p.deleted=0", wiki["id"])
    total = total_row["cnt"] if total_row else 0

    # Get recent revisions with page info
    changes = mochi.db.rows("""
        select r.id, r.title, r.author, r.name, r.created, r.version, r.comment,
               p.page as slug
        from revisions r
        join pages p on p.id=r.page
        where p.wiki=? and p.deleted=0
        order by r.created desc
        limit ? offset ?
    """, wiki["id"], limit, offset)

    # Resolve author names where not stored
    for change in changes:
        if not change["name"]:
            change["name"] = mochi.entity.name(change["author"]) or ""

    return {"data": {"changes": changes, "total": total, "limit": limit, "offset": offset}}

# Create or update a redirect
def action_redirect_set(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    source = a.input("source")
    target = a.input("target")

    if not source:
        a.error.label(400, "errors.source_is_required")
        return

    if not target:
        a.error.label(400, "errors.target_is_required")
        return

    # Normalize slugs
    source = source.lower().strip()
    target = target.lower().strip()

    # A redirect source resolves as a page slug (get_page consults redirects
    # first), so it takes the page slug rules, not just a length cap -
    # "javascript:alert(1)" is settable with edit access otherwise.
    problem = slug_problem(source)
    if problem:
        a.error.label(400, problem, name=source)
        return

    if len(target) > 100:
        a.error.label(400, "errors.target_too_long_max_100_characters")
        return

    if source == target:
        a.error.label(400, "errors.source_target_same")
        return

    # Check if target page exists
    targetpage = mochi.db.row("select id from pages where wiki=? and page=? and deleted=0", wiki["id"], target)
    if not targetpage:
        a.error.label(400, "errors.target_page_does_not_exist")
        return

    # Check if source conflicts with an existing page
    sourcepage = mochi.db.row("select id from pages where wiki=? and page=? and deleted=0", wiki["id"], source)
    if sourcepage:
        a.error.label(400, "errors.cannot_redirect_a_page_with_this_slug_already_exists")
        return

    now = mochi.time.now()
    mochi.db.execute("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki["id"], source, target, now)

    # A source broadcasts to its replicas; a replica sends upstream and the
    # source re-broadcasts. broadcast_event on a replica is a silent no-op (its
    # replicas table is empty).
    event_data = {"source": source, "target": target, "created": now}
    upstream = wiki.get("source")
    if upstream:
        mochi.message.send(
            {"from": wiki["id"], "to": upstream, "service": "wikis", "event": "redirect/set"},
            event_data
        )
    else:
        broadcast_event(wiki["id"], "redirect/set", event_data)

    return {"data": {"ok": True}}

# Delete a redirect
def action_redirect_delete(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    source = a.input("source")

    if not source:
        a.error.label(400, "errors.source_is_required")
        return

    source = source.lower().strip()
    mochi.db.execute("delete from redirects where wiki=? and source=?", wiki["id"], source)

    # Same routing as action_redirect_set.
    upstream = wiki.get("source")
    if upstream:
        mochi.message.send(
            {"from": wiki["id"], "to": upstream, "service": "wikis", "event": "redirect/delete"},
            {"source": source}
        )
    else:
        broadcast_event(wiki["id"], "redirect/delete", {"source": source})

    return {"data": {"ok": True}}

# List all redirects
def action_redirects(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return

    # No ORDER BY on `source`: it is a user-facing slug, so accents and locale
    # are the consumer's job (naturalCompare in the web). The tag list keeps its
    # `order by count desc, t.tag asc` because there the name is only the
    # tiebreaker within an equal count - the sort itself is intrinsic.
    redirects = mochi.db.rows("select source, target, created from redirects where wiki=?", wiki["id"])
    return {"data": {"redirects": redirects}}

# View wiki settings
def action_settings(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
        return

    return {"data": {"settings": {"home": wiki["home"], "source": wiki.get("source", "")}}}

# Update a wiki setting
def action_settings_set(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
        return

    name = a.input("name")
    value = a.input("value")

    if not name:
        a.error.label(400, "errors.setting_name_is_required")
        return

    if value == None:
        a.error.label(400, "errors.setting_value_is_required")
        return

    # Only allow known settings
    if name == "home":
        if not value:
            a.error.label(400, "errors.home_page_is_required")
            return
        # Exactly the page-slug rules: a home no page can have 404s the landing
        # page permanently, and a reserved one ("delete") destroys the wiki when
        # opened. Nothing consumes a multi-segment home.
        problem = slug_problem(value)
        if problem:
            a.error.label(400, problem, name=value)
            return
        mochi.db.execute("update wikis set home=? where id=?", value, wiki["id"])
    else:
        a.error.label(400, "errors.unknown_setting", name=name)
        return

    # Settings are source-owned: event_setting_set requires "manage", which is
    # never grantable, so there is no upstream route. A replica's home change is
    # a local preference; broadcast_event is a no-op there.
    if not wiki.get("source"):
        broadcast_event(wiki["id"], "setting/set", {"name": name, "value": value})

    return {"data": {"ok": True}}

# Rename a wiki
def action_rename(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
        return

    name = a.input("name")
    if not name or not mochi.text.valid(name, "name"):
        a.error.label(400, "errors.invalid_name")
        return

    if len(name) > 100:
        a.error.label(400, "errors.name_is_too_long_max_100_characters")
        return

    # Update entity (handles directory, network publishing)
    mochi.entity.update(wiki["id"], name=name)

    # Update local database
    mochi.db.execute("update wikis set name=? where id=?", name, wiki["id"])

    # Rename is source-only: event_rename resolves its target by `source=?`, so
    # an upstream send from a replica matches nothing. A replica's rename is a
    # local label; broadcast_event is a no-op there.
    if not wiki.get("source"):
        broadcast_event(wiki["id"], "rename", {"name": name})

    return {"data": {"success": True}}

# REPLICAS

# List replicas for a source wiki
def action_replicas(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
        return

    # Only source wikis have replicas
    if wiki.get("source"):
        return {"data": {"replicas": []}}

    replicas = mochi.db.rows("select id, name, subscribed, seen, synced from replicas where wiki=?", wiki["id"])

    # Look up current names from directory to avoid stale names
    for r in replicas:
        info = mochi.directory.get(r["id"])
        if info and info.get("name"):
            r["name"] = info["name"]

    return {"data": {"replicas": replicas}}

# Remove a replica
def action_replica_remove(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
        return

    replica_id = a.input("replica")
    if not replica_id:
        a.error.label(400, "errors.replica_id_is_required")
        return

    mochi.db.execute("delete from replicas where wiki=? and id=?", wiki["id"], replica_id)

    # Revoke any access permissions for the removed replica
    resource = "wiki/" + wiki["id"]
    for op in ACCESS_LEVELS + ["*"]:
        mochi.access.revoke(replica_id, resource, op)

    return {"data": {"ok": True}}

# Unsubscribe from a wiki (replica action - removes the local replica)
def action_unsubscribe(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki_id = a.input("wiki")
    if not wiki_id:
        a.error.label(400, "errors.wiki_id_is_required")
        return

    if not check_access(a, wiki_id, "manage"):
        a.error.label(403, "errors.access_denied")
        return

    # Check wiki exists locally (we have a replica of it)
    wiki = mochi.db.row("select * from wikis where id=?", wiki_id)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    # Cannot unsubscribe from own wiki
    if wiki["source"] == "":
        a.error.label(400, "errors.cannot_unsubscribe_own_wiki")
        return

    # Delete all local data for this wiki
    mochi.db.execute("delete from tags where page in (select id from pages where wiki=?)", wiki_id)
    mochi.db.execute("delete from revisions where page in (select id from pages where wiki=?)", wiki_id)
    mochi.db.execute("delete from pages where wiki=?", wiki_id)
    mochi.db.execute("delete from redirects where wiki=?", wiki_id)
    delete_wiki_comments(wiki_id)
    mochi.db.execute("delete from replicas where wiki=?", wiki_id)
    rss_tokens_revoke(wiki_id)
    mochi.db.execute("delete from wikis where id=?", wiki_id)

    # Must precede mochi.entity.delete: the message is sent AS this entity, and
    # the sender check and signature read its key from the entities table -
    # after the delete it goes out unsigned.
    registration_send(wiki["server"],
        {"from": wiki["id"], "to": wiki["source"], "service": "wikis", "event": "unreplicate"},
        {})

    # Clean up attachments, access rules, and entity registration
    attachment_clear(wiki_id)
    mochi.access.clear.resource("wiki/" + wiki_id)
    mochi.entity.delete(wiki_id)

    return {"data": {"ok": True}}

# ACCESS CONTROL

# List access rules for the wiki
def action_access_list(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
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
            rule["owner"] = True
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
            elif mochi.text.valid(subject, "entity"):
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
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
        return

    subject = a.input("subject")
    level = a.input("level")

    if not subject:
        a.error.label(400, "errors.user_or_group_required")
        return
    if len(subject) > 255:
        a.error.label(400, "errors.subject_too_long")
        return

    if not level:
        a.error.label(400, "errors.level_is_required")
        return

    if level not in ["view", "edit", "none"]:
        a.error.label(400, "errors.invalid_level")
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
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
        return

    subject = a.input("subject")

    if not subject:
        a.error.label(400, "errors.user_or_group_required")
        return
    if len(subject) > 255:
        a.error.label(400, "errors.subject_too_long")
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
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return

    query = a.input("q", "")

    if not query or len(query.strip()) == 0:
        return {"data": {"query": "", "results": []}}

    query = query.strip()

    # Use LIKE for simple search (SQLite FTS could be added later for better performance)
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = "%" + escaped + "%"

    results = mochi.db.rows("""
        select page, title, substr(content, 1, 200) as excerpt, updated
        from pages
        where wiki=? and deleted=0 and (title like ? escape '\\' or content like ? escape '\\')
        order by
            case when title like ? escape '\\' then 0 else 1 end,
            updated desc
        limit 50
    """, wiki["id"], pattern, pattern, pattern)

    return {"data": {"query": query, "results": results}}

# EVENT HANDLERS

# Helper: Check if incoming page update should be applied (conflict resolution)
# Returns True if incoming update wins, False if local version should be kept
def should_apply_update(local, version, updated, content):
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
    # Same version + same timestamp: order on the content itself. This used to
    # compare author ids, which decided the tie on a value the peer chooses -
    # a low-sorting id won every collision. Both hosts hold both texts, so
    # ordering on the text is deterministic and converges either way round,
    # and it cannot be steered without also changing what gets written.
    return content < local["content"]

# Helper: who an inbound page event is attributed to. Authorship on the wire is
# a claim, not a fact: nothing binds `author` to the sender, and it drives the
# resolved display name (action_page_revisions) and the proxied person avatar
# (action_revision_asset), so honouring it is impersonation.
#
# On a REPLICA the sender is our source, which is the authority for its own wiki
# and relays edits written by many people - its attribution stands. On a SOURCE
# the sender is a registered replica: attribute to the identity it proved when
# it registered, falling back to the replica entity for a registration predating
# that binding. Returns the author and the display name to store; a name is only
# kept alongside an attribution we did not derive ourselves.
def event_author(wikirow, wiki, sender, claim, name):
    if wikirow.get("source"):
        return claim, name
    row = mochi.db.row("select identity from replicas where wiki=? and id=?", wiki, sender)
    if row and row["identity"]:
        return row["identity"], ""
    return sender, ""

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
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    id = e.content("id")
    page = e.content("page")
    title = content_text(e, "title")
    content = content_text(e, "content")
    if content == None:
        content = ""
    author = e.content("author")
    created = content_number(e, "created", 0)
    version = e.content("version")
    name = e.content("name") or ""

    # Validate required fields
    if not id or not page or not title or not author or not created or not version:
        return

    # Same length caps as action_page_edit. Each event is a fresh revision row
    # (and a fresh page id skips the version gate), so an unbounded field here
    # is permanent storage per event.
    if len(title) > 255 or (content and len(content) > 1000000):
        return
    if name and not mochi.text.valid(name, "name"):
        return

    author, name = event_author(wikirow, wiki, sender, author, name)

    # Same slug rules as the local actions: a remote peer must not be able to
    # plant a page whose name shadows or escapes a route on our side.
    if slug_problem(page):
        return

    if not valid_version(version):
        return

    # Validate timestamp is within reasonable range (not more than 1 day in future or 1 year in past)
    now = mochi.time.now()
    if created > now + 86400 or created < now - 31536000:
        return

    # Check if page already exists
    existing = mochi.db.row("select * from pages where id=?", id)

    # The page id is a global uid; refuse to touch one that already belongs to a
    # different wiki - a colliding id must never overwrite/reassign another
    # wiki's page in this per-user DB.
    if existing and existing["wiki"] != wiki:
        return

    if existing:
        # Apply conflict resolution
        if not should_apply_update(existing, version, created, content):
            return

        # Update existing page (may be restoring a deleted page)
        mochi.db.execute("update pages set page=?, title=?, content=?, author=?, created=?, updated=?, version=?, deleted=0 where id=?",
            page, title, content, author, created, created, version, id)
    else:
        # pages(wiki, page) is UNIQUE and a constraint failure aborts the
        # handler before the revision below. The peer chooses id and slug, so
        # refuse the collision and leave the existing page intact.
        if mochi.db.exists("select 1 from pages where wiki=? and page=?", wiki, page):
            mochi.log.debug("Wiki " + wiki + " already holds slug " + page + ", refusing remote page " + id)
            return

        # Insert new page
        mochi.db.execute("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id, wiki, page, title, content, author, created, created, version)

    # Create revision record with author name
    revid = mochi.uid()
    mochi.db.execute("insert or ignore into revisions (id, page, content, title, author, name, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, ?, '')",
        revid, id, content, title, author, name, created, version)

    # If this is a source wiki and event is from a replica, re-broadcast to other replicas
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

    # Notify subscribers about new pages by other people. The P2P event
    # handler only fires for remote actions — the local user's own page
    # creates go through the action handler directly, never here.
    if author:
        wiki_name = wikirow.get("name") or ""
        notify_title = mochi.app.label("notifications.page_create.title", page=title, wiki=wiki_name)
        notify_body = mochi.app.label("notifications.page_create.body", author=name or author[:9])
        notify("page/create", id, notify_title, notify_body, "/wikis/" + wiki + "/" + page, title, event_id="page/create:" + id)

    notify_websocket(wiki)

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
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    id = e.content("id")
    page = e.content("page")
    title = content_text(e, "title")
    content = content_text(e, "content")
    if content == None:
        content = ""
    author = e.content("author")
    updated = content_number(e, "updated", 0)
    version = e.content("version")
    name = e.content("name") or ""

    # Validate required fields
    if not id or not page or not title or not author or not updated or not version:
        return

    # Enforce the same length caps as action_page_edit, so a replica can't push
    # an oversized row that we'd then store and replicate onward. `name` rides
    # into a revisions row whose id is a fresh uid every time, so `insert or
    # ignore` never ignores: unbounded here means one permanent oversized row
    # per event, and a new page id per event skips the version gate entirely.
    if len(title) > 255 or (content and len(content) > 1000000):
        return
    if name and not mochi.text.valid(name, "name"):
        return

    author, name = event_author(wikirow, wiki, sender, author, name)

    # Same slug rules as the local actions - a rename arriving over P2P must
    # not be able to move a page onto a route-shadowing or route-escaping name.
    if slug_problem(page):
        return

    if not valid_version(version):
        return

    # Same timestamp window event_page_create applies. Without it a far-future
    # `updated` pins this page to the top of Recent Changes and the page lists
    # permanently, since revision rows are never rewritten.
    now = mochi.time.now()
    if updated > now + 86400 or updated < now - 31536000:
        return

    # Check if page exists
    existing = mochi.db.row("select * from pages where id=?", id)

    # Never touch a page id that already belongs to a different wiki.
    if existing and existing["wiki"] != wiki:
        return

    # pages(wiki, page) is UNIQUE: an insert on a taken slug or an update
    # renaming onto one aborts the handler before the revision record. The peer
    # chooses the slug, so refuse the clash.
    clash = mochi.db.row("select id from pages where wiki=? and page=?", wiki, page)
    if clash and clash["id"] != id:
        mochi.log.debug("Wiki " + wiki + " already holds slug " + page + ", refusing remote update to page " + id)
        return

    if not existing:
        # Page doesn't exist locally - create it
        mochi.db.execute("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id, wiki, page, title, content, author, updated, updated, version)
    else:
        # Apply conflict resolution
        if not should_apply_update(existing, version, updated, content):
            return

        # Update page
        mochi.db.execute("update pages set page=?, title=?, content=?, author=?, updated=?, version=? where id=?",
            page, title, content, author, updated, version, id)

    # Create revision record with author name
    revid = mochi.uid()
    mochi.db.execute("insert or ignore into revisions (id, page, content, title, author, name, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, ?, '')",
        revid, id, content, title, author, name, updated, version)

    # If this is a source wiki and event is from a replica, re-broadcast to other replicas
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

    # Notify the local user about edits by other people. The P2P event
    # handler only fires for remote actions — the local user's own edits
    # go through the action handler directly, never through this path.
    if author:
        wiki_name = wikirow.get("name") or ""
        notify_title = mochi.app.label("notifications.page_update.title", page=title, wiki=wiki_name)
        notify_body = mochi.app.label("notifications.page_update.body", author=name or author[:9])
        notify("page/update", id, notify_title, notify_body, "/wikis/" + wiki + "/" + page, title, event_id="page/update:" + id + ":" + str(version))

    notify_websocket(wiki)

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
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    id = e.content("id")
    deleted = content_number(e, "deleted", 0)
    version = e.content("version")

    # Validate required fields
    if not id or not deleted or not version:
        return

    # Same version check as event_page_create/update. An unbounded delete
    # version would make every later version - restore takes version+1 - fail
    # valid_version on the replicas, so the page stays deleted there.
    if not valid_version(version):
        return

    # Same timestamp window the sibling handlers apply. The value is compared,
    # so it is read through content_number above: Starlark refuses to order a
    # string against an int, and an unguarded read would abort the handler.
    now = mochi.time.now()
    if deleted > now + 86400 or deleted < now - 31536000:
        return

    # Check if page exists
    existing = mochi.db.row("select * from pages where id=?", id)
    if not existing:
        return

    # Never soft-delete a page id that belongs to a different wiki.
    if existing["wiki"] != wiki:
        return

    # Only delete if incoming version is higher
    if version <= existing["version"]:
        return

    # Soft delete
    mochi.db.execute("update pages set deleted=?, version=? where id=?", deleted, version, id)

    # If this is a source wiki and event is from a replica, re-broadcast to other replicas
    if not wikirow.get("source") and sender:
        broadcast_event(wiki, "page/delete", {
            "id": id,
            "deleted": deleted,
            "version": version
        }, exclude=sender)

    # Notify subscribers when someone else deletes a page. Use the local
    # page row we just soft-deleted to recover the title + slug for the
    # notification text + link.
    wiki_name = wikirow.get("name") or ""
    page_title = existing.get("title") or existing.get("page") or ""
    page_slug = existing.get("page") or ""
    notify_title = mochi.app.label("notifications.page_delete.title", page=page_title, wiki=wiki_name)
    notify_body = mochi.app.label("notifications.page_delete.body", page=page_title)
    notify("page/delete", id, notify_title, notify_body, "/wikis/" + wiki + (("/" + page_slug) if page_slug else ""), page_title, event_id="page/delete:" + id + ":" + str(version))

    notify_websocket(wiki)

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
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    source = content_text(e, "source")
    target = content_text(e, "target")
    created = content_number(e, "created", 0)

    # Validate required fields
    if not source or not target or not created:
        return

    # Same normalisation action_redirect_set applies, so a remote redirect
    # cannot sit alongside a locally-created one differing only in case.
    source = source.lower().strip()
    target = target.lower().strip()
    if not source or not target:
        return

    # Same 100-character caps action_redirect_set applies. redirects is keyed
    # (wiki, source), so an unbounded source is both an unbounded string and an
    # unbounded number of rows.
    if len(target) > 100:
        return

    # The same page-slug rules the local path applies, so a peer cannot plant a
    # source the local path would refuse - route-escaping values like ../x, or
    # anything outside letters, numbers, hyphen and underscore.
    if slug_problem(source):
        return

    if source == target:
        return

    # A redirect must not shadow a live page: get_page consults redirects first,
    # so one whose source is an existing slug hides that page from every reader.
    # Same rule as action_redirect_set.
    if mochi.db.exists("select 1 from pages where wiki=? and page=? and deleted=0", wiki, source):
        return

    # The target must be a page we hold. Unlike the checks above this is
    # convergence rather than safety: a redirect can legitimately arrive before
    # the page it points at, so resync instead of dropping it, matching the
    # out-of-order handling in event_tag_add.
    if not mochi.db.exists("select 1 from pages where wiki=? and page=? and deleted=0", wiki, target):
        request_resync(wiki)
        return

    # Validate timestamp is within reasonable range (not more than 1 day in future or 1 year in past)
    now = mochi.time.now()
    if created > now + 86400 or created < now - 31536000:
        return

    # LWW gate: an event no newer than the local row is a stale duplicate from a
    # concurrent setter; drop it. Same-millisecond ties let whichever arrived
    # first stick.
    local = mochi.db.row("select created from redirects where wiki=? and source=?", wiki, source)
    if local and local["created"] >= created:
        return

    # Insert or update redirect
    mochi.db.execute("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki, source, target, created)

    # If this is a source wiki and the event came from a replica, pass it on to
    # the other replicas. Without this a redirect set on one replica reaches the
    # source and stops there, so the replicas disagree for good. Same shape as
    # event_page_delete; the LWW gate above makes the extra delivery harmless.
    if not wikirow.get("source") and sender:
        broadcast_event(wiki, "redirect/set", {"source": source, "target": target, "created": created}, exclude=sender)

    notify_websocket(wiki)

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
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    source = content_text(e, "source")
    if source:
        source = source.lower().strip()

    # Validate required fields
    if not source:
        return

    mochi.db.execute("delete from redirects where wiki=? and source=?", wiki, source)

    if not wikirow.get("source") and sender:
        broadcast_event(wiki, "redirect/delete", {"source": source}, exclude=sender)

    notify_websocket(wiki)

# Receive tag/add event
def event_tag_add(e):
    page = e.content("page")
    tag = content_text(e, "tag")

    # Validate required fields
    if not page or not tag:
        return

    # Same normalisation and limits action_tag_add applies. tags is keyed
    # (page, tag), so without them every distinct value a peer sends is another
    # permanent row, and the lowercasing keeps remote tags from splitting into
    # case variants of the ones created locally.
    tag = tag.lower().strip()
    if not tag or tag_problem(tag):
        return

    # Check if page exists and get wiki. When it does not, the wiki still has
    # to come from the routed entity so the sender can be checked before
    # anything outbound happens - request_resync below pulls a full dump from
    # the source, and an unchecked peer must not be able to drive that with a
    # fabricated page id.
    pagerow = mochi.db.row("select wiki from pages where id=?", page)
    wiki = pagerow["wiki"] if pagerow else e.header("to")
    if not wiki:
        return

    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    if not pagerow:
        # Out-of-order delivery: page hasn't arrived yet. tags.page FK
        # would FK-fail; resync via the wiki header so we converge.
        request_resync(wiki)
        return

    # Insert tag (ignore if already exists)
    mochi.db.execute("insert or ignore into tags (page, tag) values (?, ?)", page, tag)

    # Pass a replica's tag on to the other replicas; insert-or-ignore makes the
    # extra delivery a no-op for anyone who already has it.
    if not wikirow.get("source") and sender:
        broadcast_event(wiki, "tag/add", {"page": page, "tag": tag}, exclude=sender)

    notify_websocket(wiki)

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
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    mochi.db.execute("delete from tags where page=? and tag=?", page, tag)

    if not wikirow.get("source") and sender:
        broadcast_event(wiki, "tag/remove", {"page": page, "tag": tag}, exclude=sender)

    notify_websocket(wiki)

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
    # Settings (e.g. home) are owner-level, matching action_settings_set.
    if not replica_can(wikirow, wiki, sender, "manage"):
        return

    name = e.content("name")
    value = content_text(e, "value")

    # Validate required fields
    if not name or value == None:
        return

    # Only allow known settings
    if name == "home":
        # Same validation as action_settings_set: the source is trusted by
        # replica_can, and an unvalidated home ("delete") would point the client
        # at a route that destroys the replica.
        if slug_problem(value):
            return
        mochi.db.execute("update wikis set home=? where id=?", value, wiki)
        notify_websocket(wiki)

# Handle rename event from source wiki
def event_rename(e):
    wiki_id = e.header("from")
    name = content_text(e, "name")
    if not name:
        return

    # Same limits action_rename applies. This one writes a single wikis row
    # rather than appending, so it is the mildest of the group - but a name is
    # rendered in the sidebar and in notifications, so it still must not carry
    # angle brackets, newlines, or a megabyte of text.
    if not mochi.text.valid(name, "name") or len(name) > 100:
        return

    # Update subscribed wiki (source = sender)
    wiki = mochi.db.row("select id from wikis where source=?", wiki_id)
    if wiki:
        # Both halves, as action_rename does: without the entity update
        # mochi.entity.name() and the directory keep serving the old name.
        mochi.entity.update(wiki["id"], name=name)
        mochi.db.execute("update wikis set name=? where id=?", name, wiki["id"])
        notify_websocket(wiki["id"])

# REPLICATION

# Handle replication request - add requester to replicas list
# Lightweight identity probe: name + fingerprint only (no content). Matches
# feeds/forums information events; content stays behind the sync/broadcast gates.
def event_information(e):
    wiki = e.header("to")
    if not wiki:
        e.write({"error": "errors.wiki_id_is_required", "code": 400})
        return
    row = mochi.db.row("select name from wikis where id=?", wiki)
    if not row:
        e.write({"error": "errors.wiki_not_found", "code": 404})
        return
    # The name/fingerprint is only disclosed to a caller with view access -
    # knowing the id (e.g. from a share link) must not reveal it. Access is
    # grants plus membership, never the entity's privacy field, which decides
    # directory publication only; a public wiki carries the wildcard view grant
    # creation writes and passes this same check.
    if not check_event_access(e.header("from"), wiki, "view"):
        e.write({"error": "errors.access_denied", "code": 403})
        return
    e.write({"name": row["name"], "fingerprint": mochi.entity.fingerprint(wiki) or ""})

def event_replicate(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Every sibling handler looks the wiki up before writing; this one relied on
    # the replicas.wiki foreign key to reject an unknown target, which works but
    # only by accident.
    if not mochi.db.exists("select 1 from wikis where id=?", wiki):
        return

    # Get the replica's entity ID from the message header
    replica = e.header("from")
    if not replica or not mochi.text.valid(replica, "entity"):
        return

    # Bound `name`: sender entities are self-minted, (wiki, id) is the primary
    # key and core rate-limits per libp2p peer, so an unbounded name is
    # unbounded storage. valid() caps "name" at 1000 characters.
    name = e.content("name") or ""
    if name and not mochi.text.valid(name, "name"):
        return

    # No view gate here, and do not add one by analogy with forums: action_join
    # is authorised earlier, when event_sync gates the dump on the person's
    # identity. The sender entity is new and cannot hold a grant yet, so gating
    # it would break every private-wiki join. broadcast_event filters on view at
    # send time - on the identity bound below, not on this entity, which holds
    # no grant and never will.

    # The identity whose access the fan-out checks. Signed as that identity over
    # (replica, wiki, identity), so a peer cannot name a grant-holder it is not.
    # An unsigned or unverifiable claim leaves this empty and the fan-out falls
    # back to the entity, which is what a replica predating the binding sends.
    identity = ""
    claimed = e.content("identity")
    signature = e.content("signature")
    if type(claimed) == "string" and type(signature) == "string" and claimed and signature:
        if mochi.text.valid(claimed, "entity") and mochi.entity.verify(claimed, replicate_payload(replica, wiki, claimed), signature):
            identity = claimed

    # Cap NEW registrations only: sender entities are self-minted and core
    # rate-limits per peer, so the row count is otherwise unbounded. An existing
    # replica re-registering is an upsert and always allowed.
    if not mochi.db.exists("select 1 from replicas where wiki=? and id=?", wiki, replica):
        replica_count = mochi.db.row("select count(*) as total from replicas where wiki=?", wiki)
        if replica_count and replica_count["total"] >= REPLICAS_MAXIMUM:
            mochi.log.debug("Wiki " + wiki + " at the replica ceiling, refusing registration from " + replica)
            return

    now = mochi.time.now()

    # Use UPSERT to handle concurrent replicate requests atomically. The core
    # per-user directory learns the replica's route from this (claim-verified)
    # registration, so no peer is stored on the row.
    # An unsigned re-registration must not clear an identity already bound: a
    # legacy resubscribe would otherwise silently demote the replica back to the
    # entity check and stop its fan-out again.
    mochi.db.execute("""insert into replicas (wiki, id, name, identity, subscribed, seen, synced) values (?, ?, ?, ?, ?, 0, 0)
        on conflict(wiki, id) do update set name=excluded.name,
            identity=case when excluded.identity='' then replicas.identity else excluded.identity end""",
        wiki, replica, name, identity, now)

# Handle unreplication notification - remove replica and revoke access
def event_unreplicate(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Get the replica's entity ID from message header
    replica = e.header("from")
    if not replica:
        return

    # Remove from replicas table
    mochi.db.execute("delete from replicas where wiki=? and id=?", wiki, replica)

    # Revoke all access permissions
    resource = "wiki/" + wiki
    for op in ACCESS_LEVELS + ["*"]:
        mochi.access.revoke(replica, resource, op)

# INITIAL SYNC

# Handle sync request - send full wiki dump to requester
def event_sync(e):
    wiki = e.header("to")
    if not wiki:
        e.write({"error": "errors.wiki_id_is_required", "code": 400})
        return

    # Verify wiki exists
    if not mochi.db.exists("select 1 from wikis where id=?", wiki):
        e.write({"error": "errors.wiki_not_found", "code": 404})
        return

    # Check if requester has view access
    requester = e.header("from")
    if not check_event_access(requester, wiki, "view"):
        e.write({"error": "errors.access_denied", "code": 403})
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
    comments = mochi.db.rows("select * from comments where wiki=? and deleted=0", wiki)
    wikirow = mochi.db.row("select name, home from wikis where id=?", wiki)
    attachments = attachment_list(wiki) or []

    # Include comment-level attachments in each comment
    for c in comments:
        c_atts = attachment_list(c["id"]) or []
        if c_atts:
            c["attachments"] = c_atts

    # Send dump as a single payload (attachment files pulled on demand)
    source_entity = mochi.entity.info(wiki)
    e.write({
        "status": "200",
        "source": wiki,  # Source wiki entity ID for attachment fetching
        "name": wikirow["name"] if wikirow else "",
        "home": wikirow["home"] if wikirow else "home",
        "privacy": source_entity.get("privacy", "public") if source_entity else "public",
        "permissions": {"view": True, "edit": can_edit},
        "pages": pages,
        "revisions": revisions,
        "tags": tags,
        "redirects": redirects,
        "comments": comments,
        "attachments": attachments,
    })

# Handle attachment/create - replica notifies source that it uploaded a file.
# Source fetches the file from the replica via stream and saves locally.
def event_attachment_create(e):
    wiki = e.header("to")
    mochi.log.debug("attachment/create: to=%s", wiki)
    if not wiki:
        mochi.log.debug("attachment/create: no wiki header, returning")
        return

    # Verify wiki exists and is a source wiki (not a replica)
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        mochi.log.debug("attachment/create: wiki not found in db")
        return

    if wikirow.get("source"):
        mochi.log.debug("attachment/create: wiki is replica, ignoring")
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        mochi.log.debug("attachment/create: sender %s not valid", sender)
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        mochi.log.debug("attachment/create: sender %s lacks edit access", sender)
        return

    # Get attachment metadata from event content
    attachment_id = e.content("id")
    name = content_text(e, "name")
    content_type = content_text(e, "content_type", "")
    created = content_number(e, "created", 0)
    replica = e.content("replica")

    mochi.log.debug("attachment/create: id=%s name=%s replica=%s", attachment_id, name, replica)

    if not attachment_id or not name or not replica:
        mochi.log.debug("attachment/create: missing required fields")
        return

    # The stream target must be the sender: `replica` is event content, so
    # otherwise an authorised replica could make us open an outbound stream to
    # any entity and store whatever came back under its chosen id.
    if replica != sender:
        mochi.log.debug("attachment/create: replica %s is not the sender %s", replica, sender)
        return

    # Bound the metadata: it lands in the attachment store and is rendered to
    # readers. Length and control characters only - the charset stays open so
    # non-ASCII filenames keep working.
    if len(name) > 255 or not mochi.text.valid(name, "line"):
        mochi.log.debug("attachment/create: rejecting name")
        return
    if len(content_type) > 100:
        mochi.log.debug("attachment/create: rejecting content type")
        return

    # Validate timestamp is within reasonable range (not more than 1 day in future or 1 year in past)
    if created:
        now = mochi.time.now()
        if created > now + 86400 or created < now - 31536000:
            mochi.log.debug("attachment/create: timestamp out of range: %s", created)
            return

    # Check if we already have this attachment
    if attachment_exists(attachment_id):
        mochi.log.debug("attachment/create: attachment %s already exists, skipping", attachment_id)
        return

    mochi.log.debug("Fetching attachment %s from replica %s", attachment_id, replica)

    # Open stream to the replica to fetch the file data. The replica's peer is no
    # longer stored locally (the replicas.peer column was dropped in schema 2);
    # the core per-user learned directory carries the route to a private replica
    # now (#209 / #220), so a plain mochi.stream to the replica entity resolves it.
    stream = mochi.stream(
        {"from": wiki, "to": replica, "service": "wikis", "event": "attachment/fetch"},
        {"id": attachment_id}
    )

    if not stream:
        mochi.log.error("Failed to open stream to replica %s", replica)
        return

    # Read response status first
    response = stream.read()
    mochi.log.debug("Fetch response: %s", response)
    if not response or response.get("status") != "200":
        mochi.log.error("Failed to fetch attachment %s from replica %s: %s",
            attachment_id, replica, response.get("error") if response else "no response")
        return

    # Stream directly to attachment storage with the original ID (no temp file
    # needed), bounded to and held to the size the replica declared with the
    # row; a replica from before the size travelled declares nothing.
    size = e.content("size")
    attachment = attachment_receive(wiki, name, stream, content_type, attachment_id,
                                    declared=attachment_number(size) if size != None else None)

    if attachment:
        mochi.log.debug("Created attachment %s from replica %s", attachment_id, replica)
        # Tell the other replicas through this app's own event, as an upload
        # here does; the handler checks the sender's edit access before storing.
        # The supplying replica already has the file.
        broadcast_event(wiki, "attachment/add", {
            "attachments": [{
                "id": attachment["id"],
                "name": attachment["name"],
                "size": attachment["size"],
                "content_type": attachment.get("type") or attachment.get("content_type", ""),
                "rank": attachment.get("rank", 0),
                "created": attachment.get("created", 0),
            }],
        }, exclude=replica)
        notify_websocket(wiki)

# Handle attachment/delete event - replica notifies source that they deleted an attachment
# Source deletes locally and broadcasts to other replicas
def event_attachment_delete(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Verify wiki exists and is a source wiki (not a replica)
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    if wikirow.get("source"):
        # This wiki is itself a replica, ignore
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    attachment_id = e.content("id")

    if not attachment_id:
        return

    # Bind the attachment to this wiki before deleting - attachment_delete
    # resolves the id across the owner's whole wikis DB, so without this an
    # edit-replica of one wiki could delete another wiki's attachment by id.
    # Mirrors event_attachment_fetch / serve_attachment.
    att = attachment_get(attachment_id)
    if not att:
        return
    obj = att.get("object")
    if obj != wiki and not mochi.db.exists("select 1 from comments where id=? and wiki=?", obj, wiki):
        return

    # Delete locally and broadcast removal to other replicas
    attachment_delete(attachment_id)
    broadcast_event(wiki, "attachment/remove", {"id": attachment_id}, exclude=sender)
    mochi.log.debug("Deleted attachment %s from replica %s", attachment_id, sender)
    notify_websocket(wiki)

# P2P event: attachment/update — a replica edited an attachment's caption.
# Source-side counterpart of action_attachment_update: same sender checks as
# attachment/delete, the same wiki binding, then apply and restate to the
# other replicas through attachment/add (a known id is an annotation update).
def event_attachment_update(e):
    wiki = e.header("to")
    if not wiki:
        return

    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    if wikirow.get("source"):
        # This wiki is itself a replica, ignore
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    attachment_id = e.content("id")
    if not attachment_id:
        return

    att = attachment_get(attachment_id)
    if not att:
        return
    obj = att.get("object")
    if obj != wiki and not mochi.db.exists("select 1 from comments where id=? and wiki=?", obj, wiki):
        return

    caption = attachment_text(e.content("caption", ""), attachment_text_maximum)
    updated = attachment_update(attachment_id, caption, att.get("description", ""))
    if not updated:
        return
    broadcast_event(wiki, "attachment/add", {"attachments": [{"id": updated["id"], "name": updated["name"],
        "size": updated["size"], "content_type": updated.get("type") or updated.get("content_type", ""),
        "caption": updated.get("caption", ""), "description": updated.get("description", ""),
        "rank": updated.get("rank", 0), "created": updated.get("created", 0)}]}, exclude=sender)
    notify_websocket(wiki)

# Handle attachment/fetch event - serve attachment file data to requester via stream
def event_attachment_fetch(e):
    # attachment_respond takes the requester from the signed header, authorises
    # via the first callback, binds the attachment to this wiki (directly or
    # through a comment via `member`) and streams the bytes.
    wiki = e.header("to")
    wikirow = mochi.db.row("select source from wikis where id=?", wiki)
    upstream = wikirow["source"] if wikirow else ""
    attachment_respond(e, wiki,
        lambda sender, container: (upstream and sender == upstream) or check_event_access(sender, container, "view"),
        member=lambda object: mochi.db.exists("select 1 from comments where id=? and wiki=?", object, wiki))

# P2P event: attachment/add — store remote attachment metadata (files pulled on demand)
def event_attachment_add(e):
    wiki = e.header("to")
    if not wiki:
        return

    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    attachments = e.content("attachments") or []
    if attachments:
        source = wikirow.get("source") or sender
        attachment_store(attachments, source, wiki)

    notify_websocket(wiki)

# P2P event: attachment/remove — delete attachment metadata
def event_attachment_remove(e):
    wiki = e.header("to")
    if not wiki:
        return

    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    attachment_id = e.content("id")
    if attachment_id:
        # Bind the attachment to this wiki before deleting (see
        # event_attachment_delete) so a colliding id can't reach another wiki's
        # attachment.
        att = attachment_get(attachment_id)
        if att:
            obj = att.get("object")
            if obj == wiki or mochi.db.exists("select 1 from comments where id=? and wiki=?", obj, wiki):
                attachment_delete(attachment_id)

    notify_websocket(wiki)

# Helper: Import wiki dump from sync response
def import_sync_dump(wiki, dump):
    if not dump or type(dump) != "dict" or dump.get("status") != "200":
        return False

    # One transaction for the whole dump: a malformed row aborts the handler (no
    # try/except), and a partial import would leave pages without their
    # comments. Reads go through the handle to see uncommitted rows
    # (page_outside_wiki depends on it); fields use .get so a missing key skips
    # its row, not the dump.
    handle = mochi.db.transaction()

    # Import pages
    pages = dump.get("pages") or []
    for p in pages:
        id = p.get("id")
        version = p.get("version")
        if not id or not valid_version(version):
            continue
        # The dump comes from the remote wiki verbatim, so a page whose slug
        # shadows or escapes a route would be planted here just as easily as
        # over an event.
        if slug_problem(p.get("page", "")):
            continue
        # Never adopt or reassign a page that already belongs to another wiki.
        # The version comparison below is NOT a substitute: it selects on id
        # alone with no wiki filter, and the version it compares against comes
        # from the dump, so a large value made the overwrite deterministic.
        if foreign_page(id, wiki, handle):
            continue
        # Same caps the event path applies. The dump is bulk and entirely
        # remote-authored, so it is the cheapest way to plant oversized rows.
        if len(p.get("title", "")) > 255 or len(p.get("content", "")) > 1000000:
            continue
        existing = handle.row("select version from pages where id=?", id)
        if existing and existing["version"] >= version:
            continue
        handle.execute("replace into pages (id, wiki, page, title, content, author, created, updated, version, deleted) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id, wiki, p.get("page", ""), p.get("title", ""), p.get("content", ""), p.get("author", ""), p.get("created", 0), p.get("updated", 0), version, p.get("deleted", 0))

    # Import revisions. The page must be one this wiki holds - the foreign key
    # alone is satisfied by ANY page in the database, so without this a dump can
    # graft revisions onto another wiki's page, where they surface through the
    # public history, changes and RSS endpoints and can be reverted into place.
    revisions = dump.get("revisions") or []
    for r in revisions:
        id = r.get("id")
        if not id or not valid_version(r.get("version")):
            continue
        if page_outside_wiki(r.get("page", ""), wiki, handle):
            continue
        # Revision ids come from the dump, so each distinct id is another
        # permanent row; cap the strings it carries as the event path does.
        if len(r.get("title", "")) > 255 or len(r.get("content", "")) > 1000000:
            continue
        if len(r.get("name", "")) > 1000 or len(r.get("comment", "")) > 1000:
            continue
        handle.execute("insert or ignore into revisions (id, page, content, title, author, name, created, version, comment) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id, r.get("page", ""), r.get("content", ""), r.get("title", ""), r.get("author", ""), r.get("name", ""), r.get("created", 0), r.get("version"), r.get("comment", ""))

    # Import tags - same rule as revisions.
    tags = dump.get("tags") or []
    for t in tags:
        if page_outside_wiki(t.get("page", ""), wiki, handle):
            continue
        tag = (t.get("tag") or "").lower().strip()
        if not tag or tag_problem(tag):
            continue
        handle.execute("insert or ignore into tags (page, tag) values (?, ?)", t.get("page"), tag)

    # Import redirects
    redirects = dump.get("redirects") or []
    for r in redirects:
        source_slug = (r.get("source") or "").lower().strip()
        target_slug = (r.get("target") or "").lower().strip()
        if not source_slug or not target_slug:
            continue
        # redirects is keyed (wiki, source): unbounded source means unbounded
        # rows as well as an unbounded string.
        if len(target_slug) > 100:
            continue
        # Same rules as the live paths: slug charset, and no shadowing of a live
        # page (get_page consults redirects first, so a shadowed page stops
        # resolving while nothing is deleted).
        if slug_problem(source_slug):
            continue
        if handle.exists("select 1 from pages where wiki=? and page=? and deleted=0", wiki, source_slug):
            continue
        handle.execute("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki, source_slug, target_slug, r.get("created", 0))

    # Import comments. Same rule as pages - never reassign a comment that
    # already belongs to another wiki. A cross-wiki parent is dropped rather
    # than rejecting the comment, matching event_comment_create.
    comments = dump.get("comments") or []
    imported_comments = []
    # Read the canonical wiki id from OUR row, not from dump["source"]. The dump
    # is entirely remote-controlled, so letting it name the wiki a signature is
    # checked against would let a sender replay a genuine comment of Alice's from
    # one wiki into another by claiming that wiki as the source.
    wikirow_local = handle.row("select source from wikis where id=?", wiki) or {}
    signed_wiki = canonical_wiki(wikirow_local, wiki)
    for c in comments:
        id = c.get("id")
        if not id:
            continue
        if foreign_comment(id, wiki, handle):
            continue
        # Same caps event_comment_create applies, for the same reason: the id
        # is dump-supplied, so each one is another permanent row.
        if len(c.get("body", "")) > 100000 or len(c.get("name", "")) > 1000:
            continue
        if slug_problem(c.get("page", "")):
            continue
        # Same authorship rule as event_comment_create, or forging would just
        # mean waiting for a resync. An edited comment is attested by its edit
        # signature (covering the current body), an unedited one by its create
        # signature.
        author = c.get("author", "")
        name = c.get("name", "")
        body = c.get("body", "")
        created = c.get("created", 0)
        edited = c.get("edited", 0)
        signature = c.get("signature", "")
        if edited:
            payload = comment_edit_payload(id, signed_wiki, author, body, edited)
        else:
            payload = comment_create_payload(id, signed_wiki, c.get("page", ""), c.get("parent", ""), author, name, body, created)
        if not mochi.entity.verify(author, payload, signature):
            mochi.log.debug("wikis: dropped comment %s from the %s dump: bad or missing author signature for %s" % (id, wiki, author))
            continue

        # Local threading correction only, kept out of the signed value - see
        # event_comment_create for why the signed parent is never rewritten.
        parent = c.get("parent", "")
        if parent and foreign_comment(parent, wiki, handle):
            parent = ""
        # origin is the dump's source; on a replica it is not consulted
        # (replica_can grants the source everything) but the column stays
        # meaningful.
        handle.execute("replace into comments (id, wiki, page, parent, author, name, body, created, edited, deleted, origin, signature) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id, wiki, c.get("page", ""), parent, author, name, body, created, edited, c.get("deleted", 0), dump.get("source") or "", signature)
        imported_comments.append(c)

    # Import wiki name and home setting. The dump is entirely controlled by the
    # remote wiki, so `home` gets the same route-shadowing check as every other
    # write path; fall back to "home" rather than trusting it.
    name = dump.get("name")
    home = dump.get("home")
    if name and (not mochi.text.valid(name, "name") or len(name) > 100):
        name = None
    if home and (len(home) > 100 or slug_problem(home)):
        home = None
    # Written separately: a rejected value must leave the other column alone.
    if name:
        handle.execute("update wikis set name=? where id=?", name, wiki)
    if home:
        handle.execute("update wikis set home=? where id=?", home, wiki)

    handle.commit()

    # Attachment metadata lives in app.db, on a different connection, so it is
    # not covered by the transaction above - store it only once those rows are
    # actually committed, or a rolled-back import would leave metadata behind.
    source = dump.get("source")
    if source:
        attachments = dump.get("attachments") or []
        if attachments:
            attachment_store(attachments, source, wiki)
        # Only comments that landed under this wiki. attachment_store binds a
        # row to the object it is given, so an unvalidated comment id would
        # attach these rows to another wiki's comment.
        for c in imported_comments:
            c_atts = c.get("attachments") or []
            if c_atts:
                attachment_store(c_atts, source, c.get("id"))

    notify_websocket(wiki)
    return True

# Subscribe to a wiki - request to be added to their replicas list
def action_subscribe(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    # The wiki comes from the route, not the caller: without manage, any
    # authenticated stranger could make someone else's wiki send a replicate
    # request under its owner's identity. Every sibling action requires manage.
    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
        return

    # Get target wiki entity to subscribe to
    target = a.input("target")
    if not target:
        a.error.label(400, "errors.target_wiki_entity_is_required")
        return
    if not mochi.text.valid(target, "entity"):
        a.error.label(400, "errors.invalid_target")
        return

    if outbound_throttled("subscribe", target):
        a.error.label(429, "errors.too_many_requests")
        return

    # Send replicate request to target
    mochi.message.send(
        {"from": wiki["id"], "to": target, "service": "wikis", "event": "replicate"},
        replicate_content(a.user.identity.name or "", wiki["id"], target, a.user.identity.id)
    )

    return {"data": {"ok": True}}

# Request sync from upstream wiki
def action_sync(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "manage"):
        a.error.label(403, "errors.access_denied")
        return

    # Use target if specified, otherwise use the wiki's source
    target = a.input("target") or wiki.get("source")
    if not target:
        a.error.label(400, "errors.no_upstream_wiki")
        return

    if outbound_throttled("sync", target):
        a.error.label(429, "errors.too_many_requests")
        return

    # Use stored server for the wiki, or accept override
    server = a.input("server") or wiki.get("server")
    peer = None
    if server:
        peer = mochi.remote.peer(server)
        if not peer:
            a.error.label(502, "errors.unable_to_connect_to_server")
            return

    # target/server are user-supplied, so the reply may be a scalar or null;
    # test for a dict before .get or the action dies with a raw 500 instead of
    # this labelled error. Status 200 required, as in request_resync.
    dump = mochi.remote.request(target, "wikis", "sync", {}, peer)
    if not dump or type(dump) != "dict" or dump.get("error") or dump.get("status") != "200":
        a.error.label(500, "errors.failed_to_receive_sync_data")
        return

    # Import the dump (includes attachments with remote entity reference)
    if not import_sync_dump(wiki["id"], dump):
        a.error.label(500, "errors.failed_to_import_sync_data")
        return

    # Subscribe to the source wiki for future updates
    mochi.message.send(
        {"from": wiki["id"], "to": target, "service": "wikis", "event": "replicate"},
        replicate_content(wiki.get("name") or "", wiki["id"], target, a.user.identity.id if a.user else "")
    )

    return {"data": {"ok": True}}

# COMMENTS

# Build a page's comment tree from one query; returns (top-level slice, total
# top-level count). Walked iteratively with a visited set and a depth cap:
# `parent` is not a foreign key, so a hostile chain can point anywhere.
# Attachment lookups stay one per returned comment (attachment_list takes one
# object).
def page_comments(wiki_id, page_slug, limit, offset):
    rows = mochi.db.rows("select * from comments where wiki=? and page=? and deleted=0 order by created desc", wiki_id, page_slug) or []

    by_parent = {}
    for r in rows:
        key = r["parent"] or ""
        if key not in by_parent:
            by_parent[key] = []
        by_parent[key].append(r)

    roots = by_parent.get("", [])
    total = len(roots)
    page = roots[offset:offset + limit]

    seen = {}
    pending = []
    for c in page:
        pending.append((c, 0))
    i = 0
    while i < len(pending):
        node = pending[i][0]
        depth = pending[i][1]
        i += 1
        if node["id"] in seen:
            continue
        seen[node["id"]] = True
        # origin names the REPLICA that submitted the comment and exists only
        # so replica_can can authorise an edit or delete against it. It is
        # another user's entity id, and the reader has no use for it.
        node.pop("origin", None)
        node["attachments"] = attachment_list(node["id"], wiki_id) or []
        kids = []
        if depth < 100:
            for k in by_parent.get(node["id"], []):
                kids.append(k)
                pending.append((k, depth + 1))
        node["children"] = kids

    return page, total

# Helper: Count comments for a page
def page_comment_count(wiki_id, page_slug):
    row = mochi.db.row("select count(*) as count from comments where wiki=? and page=? and deleted=0", wiki_id, page_slug)
    if row:
        return row["count"]
    return 0

# Helper: Delete a comment and all its descendants.
# Collected iteratively with a worklist rather than recursively so a deeply
# nested (adversarial) comment chain can't blow the Starlark stack. `parent`
# is not a foreign key, so deletion order is unconstrained.
def delete_comment_tree(comment_id, wiki_id):
    pending = [comment_id]
    i = 0
    while i < len(pending):
        # Scope the descendant walk to this wiki so a cross-wiki parent pointer
        # can't drag another wiki's comments into the delete set.
        for child in mochi.db.rows("select id from comments where parent=? and wiki=?", pending[i], wiki_id):
            pending.append(child["id"])
        i += 1
    for cid in pending:
        for att in (attachment_list(cid, wiki_id) or []):
            attachment_delete(att["id"])
        mochi.db.execute("delete from comments where id=? and wiki=?", cid, wiki_id)

# List comments for a page
def action_page_comments(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return

    slug = a.input("page")
    if not slug:
        a.error.label(400, "errors.missing_page_parameter")
        return

    # Default generously rather than to pagination()'s 50: the web renders the
    # whole tree with no "load more", so a small default would silently hide
    # comments that load today. `truncated` says so explicitly when the cap bites.
    limit, offset = pagination(a, 200)
    comments, total = page_comments(wiki["id"], slug, limit, offset)
    count = page_comment_count(wiki["id"], slug)
    return {"data": {"comments": comments, "count": count, "total": total,
                     "truncated": offset + len(comments) < total}}

# Canonical bytes a comment signature is made over. Fields are length-prefixed
# ("12:hello world") so no content can masquerade as a different split; the
# leading scheme tag keeps create and edit payloads distinct and carries the
# version to bump if the field set changes.
def signature_payload(scheme, parts):
    out = scheme
    for p in parts:
        # Numbers go through int() before str(): a timestamp replayed as
        # 1750000000.0 must produce the bytes the author signed, or the comment
        # silently fails verification.
        s = p if type(p) == "string" else str(int(p))
        out += ":" + str(len(s)) + ":" + s
    return out

# The wiki id every host agrees on: a replica's local entity id differs from the
# owner's, so a signature over the local id fails across hosts. The source id is
# shared; on the origin the wiki is its own source.
def canonical_wiki(wikirow, fallback):
    return wikirow.get("source") or fallback

# What the author signs on create: author, place (wiki, page, parent), content
# and time, so a relay cannot alter any of them. `name` is bound because it is
# the string rendered beside the comment.
def comment_create_payload(id, wiki, page, parent, author, name, body, created):
    return signature_payload("wikis.comment.create.1",
        [id, wiki, page, parent, author, name, body, created])

# Helper: what a joining user signs when registering as a replica. `from` on a
# replicate carries the replica ENTITY, which is never the subject of an access
# rule - grants only ever go to person identities - so without this the source
# has no authenticated way to know whose view access to check when it fans out,
# and a private wiki's every broadcast drops the replica it just admitted.
# Binding the entity and the source into the payload stops a signature made for
# one replica or one wiki being replayed for another.
def replicate_payload(replica, source, identity):
    return signature_payload("wikis.replicate.1", [replica, source, identity])

# Helper: the content of a replicate registration. An unsignable identity sends
# the bare name rather than refusing: the registration still works, it just
# falls back to the entity check, which is what a source predating the binding
# does anyway.
def replicate_content(name, replica, source, identity):
    content = {"name": name or ""}
    if identity:
        signature = mochi.entity.sign(identity, replicate_payload(replica, source, identity))
        if signature:
            content["identity"] = identity
            content["signature"] = signature
    return content

# Helper: what the author signs when editing their comment. A create signature
# covers the original body, so an edit needs its own or the stored body would no
# longer match anything the author attested to.
def comment_edit_payload(id, wiki, author, body, edited):
    return signature_payload("wikis.comment.edit.1", [id, wiki, author, body, edited])

# Create a comment on a page
def action_comment_create(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    slug = a.input("page")
    if not slug:
        a.error.label(400, "errors.missing_page_parameter")
        return

    body = a.input("body")
    if not body:
        a.error.label(400, "errors.comment_body_is_required")
        return
    if len(body) > 100000:
        a.error.label(400, "errors.comment_too_long_max_100_000_characters")
        return

    parent = a.input("parent") or ""
    if parent:
        if not mochi.db.exists("select 1 from comments where id=? and wiki=? and deleted=0", parent, wiki["id"]):
            a.error.label(404, "errors.parent_comment_not_found")
            return

    now = mochi.time.now()
    id = mochi.uid()
    author = a.user.identity.id
    name = a.user.identity.name or ""

    # Sign as the author, not as the wiki. The wiki entity is what replication
    # authenticates, so a wiki-level signature would prove only that this host
    # relayed the comment - exactly the gap this closes. a.user is established
    # above, so this cannot be an anonymous caller signing as the entity owner.
    signature = mochi.entity.sign(author,
        comment_create_payload(id, canonical_wiki(wiki, wiki["id"]), slug, parent, author, name, body, now))
    # Refuse rather than store an unsignable comment. It would look fine locally
    # and be dropped by every peer that received it, which is a much harder thing
    # to diagnose than being told at the point of writing.
    if not signature:
        a.error.label(500, "errors.comment_could_not_be_signed")
        return

    mochi.db.execute("insert into comments (id, wiki, page, parent, author, name, body, created, signature) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id, wiki["id"], slug, parent, author, name, body, now, signature)

    # Save attachments (no push notification — metadata piggybacked on event)
    attachments = attachment_save(a, id) or []
    source = wiki.get("source")

    data = {
        "id": id,
        "wiki": wiki["id"],
        "page": slug,
        "parent": parent,
        "author": author,
        "name": name,
        "body": body,
        "created": now,
        "signature": signature,
    }

    # Include attachment metadata in event
    if attachments:
        data["attachments"] = [{"id": att["id"], "name": att["name"], "size": att["size"],
            "content_type": att.get("type") or att.get("content_type", ""),
            "rank": att.get("rank", 0), "created": att.get("created", 0)} for att in attachments]

    if source:
        mochi.message.send(
            {"from": wiki["id"], "to": source, "service": "wikis", "event": "comment/create"},
            data
        )
    else:
        broadcast_event(wiki["id"], "comment/create", data)

    return {"data": data}

# Edit a comment
def action_comment_edit(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    id = a.input("id")
    if not id:
        a.error.label(400, "errors.comment_id_is_required")
        return

    comment = mochi.db.row("select * from comments where id=? and wiki=? and deleted=0", id, wiki["id"])
    if not comment:
        a.error.label(404, "errors.comment_not_found")
        return

    # Only the author can edit their own comment
    if comment["author"] != a.user.identity.id:
        a.error.label(403, "errors.you_can_only_edit_your_own_comments")
        return

    body = a.input("body")
    if not body:
        a.error.label(400, "errors.comment_body_is_required")
        return
    if len(body) > 100000:
        a.error.label(400, "errors.comment_too_long_max_100_000_characters")
        return

    now = mochi.time.now()

    # Re-sign: the create signature covers the original body. The author check
    # above proves a.user is comment["author"], so this signs as themselves.
    signature = mochi.entity.sign(comment["author"],
        comment_edit_payload(id, canonical_wiki(wiki, wiki["id"]), comment["author"], body, now))
    if not signature:
        a.error.label(500, "errors.comment_could_not_be_signed")
        return

    mochi.db.execute("update comments set body=?, edited=?, signature=? where id=?", body, now, signature, id)

    data = {
        "id": id,
        "wiki": wiki["id"],
        "page": comment["page"],
        "body": body,
        "edited": now,
        "signature": signature,
    }

    source = wiki.get("source")
    if source:
        mochi.message.send(
            {"from": wiki["id"], "to": source, "service": "wikis", "event": "comment/edit"},
            data
        )
    else:
        broadcast_event(wiki["id"], "comment/edit", data)

    return {"data": data}

# Delete a comment
def action_comment_delete(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    id = a.input("id")
    if not id:
        a.error.label(400, "errors.comment_id_is_required")
        return

    comment = mochi.db.row("select * from comments where id=? and wiki=? and deleted=0", id, wiki["id"])
    if not comment:
        a.error.label(404, "errors.comment_not_found")
        return

    # Only the author or wiki owner can delete. a.owner is core's answer for the
    # routed entity, computed against the authenticated caller - get_wiki(a)
    # resolves that same route parameter, so this is the same wiki.
    is_owner = a.owner
    if comment["author"] != a.user.identity.id and not is_owner:
        a.error.label(403, "errors.cannot_delete_others_comment")
        return

    delete_comment_tree(id, wiki["id"])

    data = {
        "id": id,
        "wiki": wiki["id"],
        "page": comment["page"],
    }

    source = wiki.get("source")
    if source:
        mochi.message.send(
            {"from": wiki["id"], "to": source, "service": "wikis", "event": "comment/delete"},
            data
        )
    else:
        broadcast_event(wiki["id"], "comment/delete", data)

    return {"data": {"ok": True}}

# P2P event: comment/create
def event_comment_create(e):
    wiki = e.header("to")
    if not wiki:
        return

    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    id = e.content("id")
    page = e.content("page")
    parent = e.content("parent") or ""
    author = e.content("author")
    name = e.content("name") or ""
    body = content_text(e, "body")
    created = e.content("created")
    signature = e.content("signature") or ""

    if not id or not page or not author or not body or not created:
        return
    if not content_is_number(created):
        return

    # Same caps as action_comment_create; the id is attacker-chosen, so each
    # event is a permanent row. Run before the signature check so an oversized
    # body is dropped without hashing it.
    if len(body) > 100000:
        return
    if name and not mochi.text.valid(name, "name"):
        return
    if slug_problem(page):
        return

    # The author must have signed this themselves: everything above proves only
    # that an authorised replica sent it. An entity id is its own ed25519 public
    # key, so `author` alone verifies. Unsigned is refused, not flagged - an
    # optional signature proves nothing - so a pre-signature wikis has its
    # comments dropped here.
    if not mochi.entity.verify(author, comment_create_payload(id, canonical_wiki(wikirow, wiki), page, parent, author, name, body, created), signature):
        mochi.log.debug("wikis: rejected comment %s on wiki %s from %s: bad or missing author signature for %s" % (id, wiki, sender, author))
        return

    # A parent in a different wiki is dropped locally (a missing one is kept for
    # out-of-order delivery). The correction stays out of `parent`: that value
    # is signed, and rebroadcasting a rewritten one would invalidate the
    # signature downstream - each host re-derives its own threading.
    stored_parent = parent
    if stored_parent:
        parent_row = mochi.db.row("select wiki from comments where id=?", stored_parent)
        if parent_row and parent_row["wiki"] != wiki:
            stored_parent = ""

    # origin records the submitting replica: it is the only party allowed to edit
    # or delete this comment remotely (event_comment_edit / event_comment_delete).
    # It answers "which replica sent this", which is a different question from
    # "who wrote this" - the signature above answers that one, and both are kept.
    mochi.db.execute("insert or ignore into comments (id, wiki, page, parent, author, name, body, created, origin, signature) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id, wiki, page, stored_parent, author, name, body, created, sender or "", signature)

    # Store comment attachments from event (files pulled on demand)
    attachments = e.content("attachments") or []
    source = wikirow.get("source") or sender
    if attachments:
        attachment_store(attachments, source, id)

    # Re-broadcast if we are the source wiki. Every field here is repeated
    # exactly as signed, including the original parent, so downstream replicas
    # verify the author's signature themselves rather than taking this host's
    # word for it - the source wiki relays authorship, it does not vouch for it.
    if not wikirow.get("source") and sender:
        rebroadcast = {
            "id": id,
            "page": page,
            "parent": parent,
            "author": author,
            "name": name,
            "body": body,
            "created": created,
            "signature": signature,
        }
        if attachments:
            rebroadcast["attachments"] = attachments
        broadcast_event(wiki, "comment/create", rebroadcast, exclude=sender)

    # Notify the local user about comments by other people. The P2P event
    # handler only fires for remote actions — the local user's own
    # comments go through the action handler directly, never here.
    if author:
        page_row = mochi.db.row("select title from pages where wiki=? and page=?", wiki, page)
        page_title = page_row.get("title") if page_row else page
        wiki_name = wikirow.get("name") or ""
        notify_title = mochi.app.label("notifications.comment_create.title", page=page_title, wiki=wiki_name)
        # Truncate the body to a single-line preview at 140 chars so it
        # fits in a notification banner.
        excerpt = body[:140] + ("…" if len(body) > 140 else "")
        notify_body = mochi.app.label("notifications.comment_create.body", author=name or author[:9], excerpt=excerpt)
        notify("comment/create", id, notify_title, notify_body, "/wikis/" + wiki + "/" + page + "/comments", page_title, event_id="comment/create:" + id)

    notify_websocket(wiki)

# P2P event: comment/edit
def event_comment_edit(e):
    wiki = e.header("to")
    if not wiki:
        return

    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    id = e.content("id")
    body = e.content("body")
    edited = e.content("edited")
    signature = e.content("signature") or ""

    if not id or not body or not edited:
        return

    # Checked, not coerced: `edited` feeds comment_edit_payload, so rewriting
    # "123" to 123 would change the signed bytes. A non-number cannot be
    # compared either (Starlark will not order str against int).
    if not content_is_number(edited):
        return

    # Clamp the sender-supplied timestamp to the window event_page_create uses.
    # The LWW gate below compares it directly, so an edit stamped far in the
    # future would outrank every later legitimate edit by the real author,
    # permanently.
    now = mochi.time.now()
    if edited > now + 86400 or edited < now - 31536000:
        return

    # LWW gate: skip if our locally-stored edit is at least as new.
    # `edited` is 0 for never-edited comments, so the first edit always
    # wins over the create-time state.
    local = mochi.db.row("select edited, origin, author from comments where id=? and wiki=?", id, wiki)
    if not local:
        request_resync(wiki)
        return

    # The new body must be signed by the ORIGINAL author from our own row, or a
    # sender could rewrite the body and supply any signer. This deliberately
    # ends remote body-editing by manage-holders; moderation keeps delete.
    if not mochi.entity.verify(local["author"], comment_edit_payload(id, canonical_wiki(wikirow, wiki), local["author"], body, edited), signature):
        mochi.log.debug("wikis: rejected edit of comment %s on wiki %s from %s: bad or missing author signature for %s" % (id, wiki, sender, local["author"]))
        return

    # A replica may only edit a comment it submitted: replica_can proves general
    # edit access, which on a public wiki is everyone. Locally-authored comments
    # (origin='') are never remotely editable.
    if local["origin"] != sender and not replica_can(wikirow, wiki, sender, "manage"):
        return
    if local["edited"] >= edited:
        return

    mochi.db.execute("update comments set body=?, edited=?, signature=? where id=? and wiki=?", body, edited, signature, id, wiki)

    # Re-broadcast if we are the source wiki, carrying the author's signature so
    # downstream replicas check it themselves rather than trusting this relay.
    if not wikirow.get("source") and sender:
        broadcast_event(wiki, "comment/edit", {
            "id": id,
            "wiki": wiki,
            "signature": signature,
            "body": body,
            "edited": edited,
        }, exclude=sender)

    notify_websocket(wiki)

# P2P event: comment/delete
def event_comment_delete(e):
    wiki = e.header("to")
    if not wiki:
        return

    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    id = e.content("id")
    if not id:
        return

    comment = mochi.db.row("select * from comments where id=? and wiki=?", id, wiki)
    if not comment:
        return

    # Same rule as event_comment_edit: a replica may only delete a comment it
    # submitted. delete_comment_tree is a HARD delete of the subtree and its
    # attachments, so without this any edit-capable sender could destroy another
    # user's comment thread irrecoverably.
    if comment.get("origin", "") != sender and not replica_can(wikirow, wiki, sender, "manage"):
        return

    delete_comment_tree(id, wiki)

    # Re-broadcast if we are the source wiki
    if not wikirow.get("source") and sender:
        broadcast_event(wiki, "comment/delete", {
            "id": id,
            "wiki": wiki,
            "page": comment["page"],
        }, exclude=sender)

    notify_websocket(wiki)

# ATTACHMENTS

# Attachment routes are public so anonymous viewers can load a public wiki's
# files; serve_attachment is the gate (on a.user, never ambient ownership) and
# binds the attachment to this wiki.
def action_attachment(a):
    serve_attachment(a, "")

def action_attachment_thumbnail(a):
    serve_attachment(a, "thumbnail")

def action_attachment_preview(a):
    serve_attachment(a, "preview")

def serve_attachment(a, variant):
    attachment = a.input("id")
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.attachment_not_found")
        return

    # The gate and the binding run for replicas too - never defer to "the source
    # enforces access on pull": a revoked or deleted source would keep a cached
    # copy serving. check_access takes its subject from a.user, so an anonymous
    # caller is tested against the "*" grant alone.
    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "attachment.errors.denied")
        return
    # The source adopts legacy remote-provenance rows on first serve, taking
    # the bytes in; replicas keep pulling to cache. (The live upload path
    # already lands bytes on the source - event_attachment_create pulls at
    # accept - so adoption only heals rows minted before that flow.)
    attachment_serve(a, attachment, wiki["id"],
        variant=variant,
        member=lambda object: mochi.db.exists("select 1 from comments where id=? and wiki=?", object, wiki["id"]),
        adopt=not wiki.get("source"))

# List all wiki attachments
def action_attachments(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return

    # Replica rows are stored under the local wiki id by every write path, so
    # this one lookup covers a replica as well as a source. Merging rows held
    # under the source id would only add entries serve_attachment refuses,
    # since it binds an attachment to wiki["id"].
    attachments = attachment_list(wiki["id"], wiki["id"]) or []
    return {"data": {"attachments": attachments}}

# Upload an attachment
def action_attachment_upload(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    # If this is a replica wiki, save locally then notify source asynchronously
    source = wiki.get("source")
    if source:
        # Save attachment locally first (immediately available)
        attachments = attachment_save(a, wiki["id"])
        if not attachments:
            a.error.label(400, "errors.no_files_uploaded")
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
                    "replica": wiki["id"],  # So source knows where to fetch from
                }
            )

        return {"data": {"attachments": attachments}}

    # Save uploaded attachments (no push notification — metadata piggybacked)
    attachments = attachment_save(a, wiki["id"])

    if not attachments:
        a.error.label(400, "errors.no_files_uploaded")
        return

    # Broadcast attachment metadata to replicas (files pulled on demand)
    broadcast_event(wiki["id"], "attachment/add", {
        "attachments": [{"id": att["id"], "name": att["name"], "size": att["size"],
            "content_type": att.get("type") or att.get("content_type", ""),
            "rank": att.get("rank", 0), "created": att.get("created", 0)} for att in attachments],
    })

    return {"data": {"attachments": attachments}}

# Delete an attachment
def action_attachment_delete(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "delete"):
        a.error.label(403, "errors.access_denied")
        return

    id = a.input("id")
    if not id:
        a.error.label(400, "errors.attachment_id_is_required")
        return

    source = wiki.get("source")

    # Bind the attachment to this wiki before deleting: attachment_delete
    # resolves a bare id across the owner's whole wikis database, which every
    # wiki they hold shares. Same binding as the event handlers and
    # serve_attachment.
    att = attachment_get(id)
    if not att:
        a.error.label(404, "errors.attachment_not_found")
        return
    obj = att.get("object")
    if obj != wiki["id"] and not mochi.db.exists("select 1 from comments where id=? and wiki=?", obj, wiki["id"]):
        a.error.label(404, "errors.attachment_not_found")
        return

    # Delete locally (no push notification — metadata piggybacked)
    if not attachment_delete(id):
        a.error.label(404, "errors.attachment_not_found")
        return

    # Source broadcasts removal to replicas
    if not source:
        broadcast_event(wiki["id"], "attachment/remove", {"id": id})

    # Remove references to this attachment from all pages
    ref = "attachments/" + id
    pages = mochi.db.rows("select id, page, title, content, version from pages where wiki=? and content like ?", wiki["id"], "%" + ref + "%")
    now = mochi.time.now()
    author = a.user.identity.id
    name = a.user.identity.name

    for page in pages:
        new_content = remove_attachment_references(page["content"], id)
        if new_content != page["content"]:
            # Use atomic version increment to prevent race conditions
            mochi.db.execute("update pages set content=?, author=?, updated=?, version=version+1 where id=?",
                new_content, author, now, page["id"])
            version = mochi.db.row("select version from pages where id=?", page["id"])["version"]
            create_revision(page["id"], page["title"], new_content, author, name, version, system_comment("revisions.attachment"))
            # Notify: source broadcasts to replicas, replica notifies source
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

    # Notify source of attachment deletion (if replica)
    if source:
        mochi.message.send(
            {"from": wiki["id"], "to": source, "service": "wikis", "event": "attachment/delete"},
            {"id": id}
        )

    return {"data": {"ok": True}}

# Update an attachment's caption
def action_attachment_update(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "edit"):
        a.error.label(403, "errors.access_denied")
        return

    id = a.input("id")
    if not id:
        a.error.label(400, "errors.attachment_id_is_required")
        return

    caption = a.input("caption", "")
    if type(caption) != "string" or len(caption) > 1000:
        a.error.label(400, "errors.access_denied")
        return

    # Bind the attachment to this wiki before annotating, for the same reason
    # action_attachment_delete does: the id resolves across every wiki this
    # user holds, and edit rights on one must not annotate another's.
    att = attachment_get(id)
    if not att:
        a.error.label(404, "errors.attachment_not_found")
        return
    obj = att.get("object")
    if obj != wiki["id"] and not mochi.db.exists("select 1 from comments where id=? and wiki=?", obj, wiki["id"]):
        a.error.label(404, "errors.attachment_not_found")
        return

    updated = attachment_update(id, caption, att.get("description", ""))
    if not updated:
        a.error.label(404, "errors.attachment_not_found")
        return

    source = wiki.get("source")
    restatement = {"attachments": [{"id": updated["id"], "name": updated["name"], "size": updated["size"],
        "content_type": updated.get("type") or updated.get("content_type", ""),
        "caption": updated.get("caption", ""), "description": updated.get("description", ""),
        "rank": updated.get("rank", 0), "created": updated.get("created", 0)}]}
    if source:
        # Replica: applied locally above; the source applies it and restates
        # to the other replicas.
        mochi.message.send(
            {"from": wiki["id"], "to": source, "service": "wikis", "event": "attachment/update"},
            {"id": id, "caption": caption}
        )
    else:
        # Source: restate the row to replicas; attachment_store treats a known
        # id as an annotation update.
        broadcast_event(wiki["id"], "attachment/add", restatement)

    return {"data": {"attachment": updated}}

# CROSS-APP PROXY ACTIONS

# Proxy user search to people app
def action_users_search(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    query = a.input("search", "")
    results = mochi.service.call("people", "users/search", query)
    return {"data": {"results": results}}

# Proxy groups list to people app
def action_groups(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    groups = mochi.service.call("people", "groups/list")
    return {"data": {"groups": groups}}

# RSS FEED SUPPORT

# Escape special XML characters
def escape_xml(s):
    if not s:
        return ""
    s = s.replace("&", "&amp;")
    s = s.replace("<", "&lt;")
    s = s.replace(">", "&gt;")
    s = s.replace('"', "&quot;")
    return s

# Generate or retrieve an RSS token for an entity and mode
def action_rss_token(a):
    if not a.user:
        a.error.label(401, "errors.authentication_required")
        return

    entity = a.input("entity")
    mode = a.input("mode")
    if not entity or not mode:
        a.error.label(400, "errors.missing_entity_or_mode")
        return
    if mode != "changes" and mode != "comments" and mode != "all":
        a.error.label(400, "errors.mode_must_be_changes_comments_or_all")
        return

    if entity == "*":
        wiki_id = "*"
    else:
        wiki = mochi.db.row("select * from wikis where id=?", entity)
        if not wiki:
            # Try resolving as fingerprint
            all_wikis = mochi.db.rows("select id from wikis")
            for w in all_wikis:
                if mochi.entity.fingerprint(w["id"]) == entity:
                    wiki = w
                    break
        if not wiki:
            a.error.label(404, "errors.wiki_not_found")
            return
        wiki_id = wiki["id"]

    # Only the hash is kept, so an already-issued URL cannot be shown again.
    # Report that it exists and let the caller decide: re-issuing silently would
    # break whatever reader is already polling the old URL.
    regenerate = a.input("regenerate") == "1"
    existing = mochi.db.row("select hash from rss where entity=? and mode=?", wiki_id, mode)
    if existing and not regenerate:
        return {"data": {"exists": True}}

    if existing:
        mochi.token.delete(existing["hash"])
        mochi.db.execute("delete from rss where entity=? and mode=?", wiki_id, mode)

    # Create new token, bound to the feed action and this wiki alone. A feed
    # URL is shared casually and lives in reader histories and proxy logs, so
    # it must not also authorise the app's other actions.
    if wiki_id == "*":
        token = mochi.token.create("rss", ["rss"], 0, "-/rss", "")
    else:
        token = mochi.token.create("rss", ["rss"], 0, ":wiki/-/rss", wiki_id)
    if not token:
        a.error.label(500, "errors.failed_to_create_token")
        return

    now = mochi.time.now()
    mochi.db.execute("insert into rss (hash, entity, mode, created) values (?, ?, ?, ?)",
        mochi.crypto.hash.sha256(token), wiki_id, mode, now)
    return {"data": {"token": token}}

# Revoke a wiki's RSS access: delete the core token(s) and rss row(s) so the RSS
# URL stops working. The next Copy RSS URL mints a fresh token.
def action_rss_token_revoke(a):
    if not a.user:
        a.error.label(401, "errors.authentication_required")
        return

    entity = a.input("entity")
    if not entity:
        a.error.label(400, "errors.missing_entity_or_mode")
        return

    if entity == "*":
        wiki_id = "*"
    else:
        wiki = mochi.db.row("select * from wikis where id=?", entity)
        if not wiki:
            for w in mochi.db.rows("select id from wikis") or []:
                if mochi.entity.fingerprint(w["id"]) == entity:
                    wiki = w
                    break
        if not wiki:
            a.error.label(404, "errors.wiki_not_found")
            return
        wiki_id = wiki["id"]

    rss_tokens_revoke(wiki_id)
    return {"data": {"ok": True}}

# Per-wiki RSS feed
def action_rss(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    # Look up mode from token (token also authenticates for private wikis)
    token = a.input("token")
    mode = "changes"
    rss_row = None
    if token:
        rss_row = mochi.db.row("select mode from rss where hash=? and entity=?", mochi.crypto.hash.sha256(token), wiki["id"])
        # The token authorises one wiki. Refuse outright rather than falling
        # through to check_access below, which resolves against the token's
        # issuer and would pass for any wiki that issuer owns.
        if not rss_row:
            a.error.label(403, "errors.not_allowed")
            return
        mode = rss_row["mode"]

    if not rss_row and not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.not_allowed")
        return

    wiki_name = wiki["name"]
    fingerprint = mochi.entity.fingerprint(wiki["id"])

    a.header("Content-Type", "application/rss+xml; charset=utf-8")
    a.print('<?xml version="1.0" encoding="UTF-8"?>\n')
    a.print('<rss version="2.0">\n')
    a.print('<channel>\n')
    a.print('<title>' + escape_xml(wiki_name) + '</title>\n')
    a.print('<link>/wikis/' + escape_xml(fingerprint) + '</link>\n')
    a.print('<description>' + escape_xml(wiki_name) + ' wiki changes</description>\n')

    if mode == "all":
        rows = mochi.db.rows("""
            select 'change' as type, r.id, r.title, r.name, r.created, r.version, r.comment as description, p.page as slug
            from revisions r join pages p on p.id = r.page
            where p.wiki = ? and p.deleted = 0
            union all
            select 'comment' as type, c.id, coalesce(p.title, c.page) as title, c.name, c.created, 0 as version, c.body as description, c.page as slug
            from comments c left join pages p on p.wiki = c.wiki and p.page = c.page and p.deleted = 0
            where c.wiki = ? and c.deleted = 0
            order by created desc limit 100
        """, wiki["id"], wiki["id"])
    elif mode == "comments":
        rows = mochi.db.rows("""
            select 'comment' as type, c.id, coalesce(p.title, c.page) as title, c.name, c.created, 0 as version, c.body as description, c.page as slug
            from comments c left join pages p on p.wiki = c.wiki and p.page = c.page and p.deleted = 0
            where c.wiki = ? and c.deleted = 0
            order by c.created desc limit 50
        """, wiki["id"])
    else:
        rows = mochi.db.rows("""
            select 'change' as type, r.id, r.title, r.name, r.created, r.version, r.comment as description, p.page as slug
            from revisions r join pages p on p.id = r.page
            where p.wiki = ? and p.deleted = 0
            order by r.created desc limit 50
        """, wiki["id"])

    if rows:
        a.print('<lastBuildDate>' + mochi.time.local(rows[0]["created"], "rfc822") + '</lastBuildDate>\n')

    for row in rows:
        if row["type"] == "comment":
            title = mochi.app.label("rss.comment", title=row["title"], name=row["name"])
            desc = row["description"]
            if len(desc) > 500:
                desc = desc[:500] + "..."
        else:
            title = mochi.app.label("rss.edited", title=row["title"], name=row["name"])
            # revision_comment resolves a system comment, which is stored as
            # {"key": ..., "args": ...} JSON - the feed rendered that JSON
            # verbatim. The fallback was a bare English literal in a feed that
            # is otherwise fully translated.
            desc = revision_comment(row["description"]) if row["description"] else mochi.app.label("rss.version", version=str(row["version"]))

        link = "/wikis/" + fingerprint + "/" + row["slug"]

        a.print('<item>\n')
        a.print('<title>' + escape_xml(title) + '</title>\n')
        a.print('<link>' + escape_xml(link) + '</link>\n')
        a.print('<description>' + escape_xml(desc) + '</description>\n')
        a.print('<pubDate>' + mochi.time.local(row["created"], "rfc822") + '</pubDate>\n')
        a.print('<guid isPermaLink="false">' + escape_xml(row["id"]) + '</guid>\n')
        a.print('</item>\n')

    a.print('</channel>\n')
    a.print('</rss>')

# All wikis RSS feed
def action_rss_all(a):
    # Look up mode from token (token also authenticates for RSS readers)
    token = a.input("token")
    mode = "changes"
    rss_row = None
    if token:
        rss_row = mochi.db.row("select mode from rss where hash=? and entity='*'", mochi.crypto.hash.sha256(token))
        if rss_row:
            mode = rss_row["mode"]

    if not rss_row and not a.user:
        a.error.label(401, "errors.authentication_required")
        return

    a.header("Content-Type", "application/rss+xml; charset=utf-8")
    a.print('<?xml version="1.0" encoding="UTF-8"?>\n')
    a.print('<rss version="2.0">\n')
    a.print('<channel>\n')
    a.print('<title>All wikis</title>\n')
    a.print('<link>/wikis</link>\n')
    a.print('<description>All wiki changes</description>\n')

    # Build wiki name lookup
    wiki_names = {}
    wiki_fps = {}
    all_wikis = mochi.db.rows("select id, name from wikis")
    for w in all_wikis:
        wiki_names[w["id"]] = w["name"]
        fp = mochi.entity.fingerprint(w["id"])
        if fp:
            wiki_fps[w["id"]] = fp

    if mode == "all":
        rows = mochi.db.rows("""
            select 'change' as type, r.id, r.title, r.name, r.created, r.version, r.comment as description, p.page as slug, p.wiki
            from revisions r join pages p on p.id = r.page
            where p.deleted = 0
            union all
            select 'comment' as type, c.id, coalesce(p.title, c.page) as title, c.name, c.created, 0 as version, c.body as description, c.page as slug, c.wiki
            from comments c left join pages p on p.wiki = c.wiki and p.page = c.page and p.deleted = 0
            where c.deleted = 0
            order by created desc limit 100
        """)
    elif mode == "comments":
        rows = mochi.db.rows("""
            select 'comment' as type, c.id, coalesce(p.title, c.page) as title, c.name, c.created, 0 as version, c.body as description, c.page as slug, c.wiki
            from comments c left join pages p on p.wiki = c.wiki and p.page = c.page and p.deleted = 0
            where c.deleted = 0
            order by c.created desc limit 50
        """)
    else:
        rows = mochi.db.rows("""
            select 'change' as type, r.id, r.title, r.name, r.created, r.version, r.comment as description, p.page as slug, p.wiki
            from revisions r join pages p on p.id = r.page
            where p.deleted = 0
            order by r.created desc limit 50
        """)

    if rows:
        a.print('<lastBuildDate>' + mochi.time.local(rows[0]["created"], "rfc822") + '</lastBuildDate>\n')

    for row in rows:
        wiki_id = row["wiki"]
        wiki_name = wiki_names.get(wiki_id, "Wiki")
        wiki_fp = wiki_fps.get(wiki_id, wiki_id)

        if row["type"] == "comment":
            title = wiki_name + ": " + mochi.app.label("rss.comment", title=row["title"], name=row["name"])
            desc = row["description"]
            if len(desc) > 500:
                desc = desc[:500] + "..."
        else:
            title = wiki_name + ": " + mochi.app.label("rss.edited", title=row["title"], name=row["name"])
            # revision_comment resolves a system comment, which is stored as
            # {"key": ..., "args": ...} JSON - the feed rendered that JSON
            # verbatim. The fallback was a bare English literal in a feed that
            # is otherwise fully translated.
            desc = revision_comment(row["description"]) if row["description"] else mochi.app.label("rss.version", version=str(row["version"]))

        link = "/wikis/" + wiki_fp + "/" + row["slug"]

        a.print('<item>\n')
        a.print('<title>' + escape_xml(title) + '</title>\n')
        a.print('<link>' + escape_xml(link) + '</link>\n')
        a.print('<description>' + escape_xml(desc) + '</description>\n')
        a.print('<pubDate>' + mochi.time.local(row["created"], "rfc822") + '</pubDate>\n')
        a.print('<guid isPermaLink="false">' + escape_xml(row["id"]) + '</guid>\n')
        a.print('</item>\n')

    a.print('</channel>\n')
    a.print('</rss>')

# Generate Open Graph meta tags for wiki pages
def opengraph_wiki(params):
    wiki_id = params.get("entity", "") or params.get("wiki", "")
    page_slug = params.get("page", "")

    # Default values
    og = {
        "title": mochi.app.label("opengraph.fallback.title"),
        "description": mochi.app.label("opengraph.fallback.description"),
        "type": "website"
    }

    # Look up wiki
    if not wiki_id:
        return og

    wiki = mochi.db.row("select * from wikis where id=?", wiki_id)
    if not wiki:
        return og

    # OpenGraph runs in the owner's database context with no caller identity, so
    # a private wiki must leak
    # nothing, not even its name. mochi.access.check(None, ...) directly -
    # check_access() would pass via the
    # thread-local owner - and not entity privacy, which is private on every
    # replica regardless of the source.
    if not mochi.access.check(None, "wiki/" + wiki["id"], "view"):
        return og

    og["title"] = wiki["name"]
    og["description"] = mochi.app.label("opengraph.wiki.description", name=wiki["name"])

    # If specific page requested, use page content
    if page_slug:
        page = mochi.db.row("select * from pages where wiki=? and page=? and deleted=0", wiki["id"], page_slug)
        if page:
            og["type"] = "article"
            og["title"] = page["title"] + " - " + wiki["name"]

            # Use first 200 chars of content as description, stripping markdown
            content = page.get("content", "")
            if content:
                # Bound first: the result is truncated to 200 characters anyway,
                # and the link-stripping loop below is O(links x length) over a
                # page that can reach 1MB, on the anonymous crawler path.
                desc = content[:4000]
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
