# Mochi wiki app
# Copyright © 2026 Mochisoft OÜ
# SPDX-License-Identifier: AGPL-3.0-only
# This file is part of Mochi, licensed under the GNU AGPL v3 with the
# Mochi Application Interface Exception - see license.txt and license-exception.md.

# Helper: send a notification through the user's notifications app.
# Mirrors apps/forums/forums.star `notify()`. The topic-label key resolves
# to the per-locale string in apps/wikis/labels/<lang>.conf under
# `notifications.topic.<topic-with-dots>` so the notifications app can
# render the topic header in the user's language.
# remote_error surfaces a failed mochi.remote.request: core-authored
# transport failures (marked "transport") become a translated generic
# error with the detail kept in the server log; far-end app answers
# pass through unchanged.
def remote_error(a, response, code=502):
    if response.get("transport"):
        mochi.log.info("Remote transport error: %s", response.get("error", ""))
        a.error.label(response.get("code", code), "errors.remote")
    else:
        a.error(response.get("code", code), response.get("error", "Error"))

def notify(topic, object="", title="", body="", url="", name="", event_id=""):
	mochi.service.call("notifications", "send", topic, object, title, body, url, mochi.app.label("notifications.topic." + topic.replace("/", ".")), name, "", None, event_id)

# Database creation

def database_upgrade(version):
    if version == 3:
        # Drop the pre-2026-07 broadcast tables left in the app data DB when
        # broadcast state moved to the per-app system DB - inert, but stale
        # sequence/log copies mislead diagnosis.
        for table in ["sequence", "log", "acknowledged", "received"]:
            mochi.db.execute("drop table if exists " + table)

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
    mochi.db.execute("create table if not exists replicas (wiki text not null references wikis(id), id text not null, name text not null default '', subscribed integer not null, seen integer not null default 0, synced integer not null default 0, primary key (wiki, id))")

    # Unreplicate tombstones - wikis we unreplicated as a replica, keyed by our
    # local (now-deleted) wiki id, recording the source to notify. Lets a dropped
    # broadcast re-send the unreplicate to the source (which may have missed our
    # original one) without keeping the wiki's heavy data around. See
    # unreplicate_stale().
    mochi.db.execute("create table if not exists unreplicated (wiki text not null primary key, source text not null, synced integer not null default 0)")

    # Comments table
    mochi.db.execute("create table if not exists comments (id text primary key, wiki text not null references wikis(id), page text not null, parent text not null default '', author text not null, name text not null default '', body text not null, created integer not null, edited integer not null default 0, deleted integer not null default 0)")
    mochi.db.execute("create index if not exists comments_wiki on comments(wiki)")
    mochi.db.execute("create index if not exists comments_page on comments(page)")
    mochi.db.execute("create index if not exists comments_parent on comments(parent)")
    mochi.db.execute("create index if not exists comments_created on comments(created)")

    # RSS tokens table
    mochi.db.execute("create table if not exists rss (token text not null primary key, entity text not null, mode text not null, created integer not null, unique(entity, mode))")

def database_upgrade(version):
    # Schema 2: the replicas.peer column is gone - the core per-user directory
    # now carries the route to a private replica, so the owner no longer stores
    # each replica's peer (see #209 / #220). Drop the now-unused column.
    if version == 2:
        for c in mochi.db.table("replicas"):
            if c["name"] == "peer":
                mochi.db.execute("alter table replicas drop column peer")
                break

def update_replica_seen(wiki, replica_id):
    now = mochi.time.now()
    mochi.db.execute("update replicas set seen=?, synced=? where wiki=? and id=?", now, now, wiki, replica_id)

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

# Helper: authorize a replica-originated mutation on the source side.
# validate_event_sender only proves the sender is a registered replica
# (authenticity); it does NOT check the replica's access level. When we are the
# source, the replica must additionally hold `operation` access (e.g. "edit")
# for the change to apply — otherwise a view-only replica's edits would be
# accepted upstream and replicated onward. Source->replica propagation (we are a
# replica, sender is our authoritative source) is always allowed.
def replica_can(wikirow, wiki, sender, operation):
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

# unreplicate_stale: a broadcast arrived for a wiki we no longer hold. If we
# kept an unreplicate tombstone for it, the source missed our original
# unreplicate (offline past the queue age) and is still fanning out to us. Re-send
# the unreplicate to the RECORDED source - never the broadcast sender, which in a
# chained setup (we were a replica of one wiki and a re-broadcasting source for
# another) could be a downstream replica whose row we'd wrongly delete. The
# source's event_unreplicate deletes only (source, us), so this can never remove
# anyone else's registration. error_message_timeout still covers the dead-host
# case (us at 0 locations); this covers the alive-but-unreplicated case it can't.
# Throttled to once per 60s per wiki so a burst of broadcasts can't spam the
# source before it processes the first unreplicate.
def unreplicate_stale(wiki):
    row = mochi.db.row("select source, synced from unreplicated where wiki=?", wiki)
    if not row:
        return
    now = mochi.time.now()
    if row["synced"] and now - row["synced"] < 60:
        return
    mochi.db.execute("update unreplicated set synced=? where wiki=?", now, wiki)
    mochi.message.send({"from": wiki, "to": row["source"], "service": "wikis", "event": "unreplicate"}, {})

# error_broadcast_gap: core calls this when an unfillable broadcast gap was
# skipped and events were permanently lost. broadcast/resync can't replay a
# pruned gap, so pull a fresh full snapshot.
def error_broadcast_gap(e):
    request_resync(e.entity)


# idle_resync_age: how long without applying any broadcast from a replica's
# source wiki before the next view re-registers as a replica (the source may
# have pruned us after a long idle). Matches core's broadcast_log_age.
idle_resync_age = 7 * 86400

# request_resync pulls a fresh sync dump from the source wiki when an
# incoming event references a page or comment we haven't seen. The
# source's event_sync is the canonical state; import_sync_dump applies it
# idempotently. Throttled to one call per 60 seconds per wiki. Only
# meaningful for replicas — source wikis are the canonical state.
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
    dump = mochi.remote.request(row["source"], "wikis", "sync", {}, peer)
    if not dump or dump.get("status") != "200":
        return False
    import_sync_dump(wiki_id, dump)
    mochi.broadcast.touch(row["source"])
    fp = mochi.entity.fingerprint(wiki_id)
    if fp:
        mochi.websocket.write(fp, {"type": "wiki/resynced", "wiki": wiki_id})
    return True

# maybe_resubscribe re-registers a replica with its source wiki when the
# subscription has gone idle (idle_resync_age). The source's event_replicate is
# idempotent and pushes a sync dump, so a bare re-replicate re-adds us and
# re-syncs; touch() stamps the idle timer (keyed by source - the broadcast key)
# so a quiet wiki re-registers at most once per window and a dead source isn't
# re-poked per view.
def maybe_resubscribe(a, wiki_id):
    user_id = a.user.identity.id if a.user else None
    if not user_id:
        return
    row = mochi.db.row("select source, name from wikis where id=?", wiki_id)
    if not row or not row["source"]:
        return
    source = row["source"]
    if mochi.time.now() - mochi.broadcast.seen(source) <= idle_resync_age:
        return
    mochi.message.send(
        {"from": wiki_id, "to": source, "service": "wikis", "event": "replicate"},
        {"name": row["name"]}
    )
    mochi.broadcast.touch(source)

# Helper: Broadcast event to all replicas of a wiki via the durable
# broadcast log. Sequence + log + gap-detection live in core. Replicas
# whose view access has been revoked are filtered out client-side
# before handing the recipient list to mochi.broadcast.send.
def broadcast_event(wiki, event, data, exclude=None):
    if not wiki:
        return
    resource = "wiki/" + wiki
    replicas = mochi.db.rows("select id from replicas where wiki=?", wiki)
    recipients = []
    for r in replicas:
        if not mochi.access.check(r["id"], resource, "view"):
            continue
        # A replica is a private entity on the subscriber's server, not
        # directory-listed; the core per-user directory carries the route
        # (learned when the replica registered), so no app-level peer pin.
        recipients.append(r["id"])
    mochi.broadcast.send(wiki, wiki, recipients, "wikis", event, data, exclude or "")

# notify_websocket: tell any locally-open wiki UI that this wiki's content
# changed, so the web refreshes pages/comments/tags the moment remote sync data
# (the initial dump or a live broadcast) lands locally instead of staying stale
# until a manual reload. The key is the wiki's fingerprint, matching the web's
# websocket connection key. Distinct from notify(), which sends push/email.
def notify_websocket(wiki):
    if not wiki:
        return
    fp = mochi.entity.fingerprint(wiki)
    if fp:
        mochi.websocket.write(fp, {"type": "wiki/update", "wiki": wiki})

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

# Helper: Get page by slug, following redirects
def get_page(wiki, slug):
    # Check for redirect first
    redirect = mochi.db.row("select target from redirects where wiki=? and source=?", wiki, slug)
    if redirect:
        slug = redirect["target"]

    page = mochi.db.row("select * from pages where wiki=? and page=? and deleted=0", wiki, slug)
    return page

# Helper: Extract internal wiki links from markdown content
def extract_wiki_links(content):
    links = []
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
                            if url and url not in links:
                                links.append(url)
                    i = k
        i += 1
    return links

# Helper: Find which linked pages don't exist
def find_missing_links(wiki, content):
    links = extract_wiki_links(content)
    missing = []
    for link in links:
        # Check if page exists (don't follow redirects for this check)
        exists = mochi.db.exists("select 1 from pages where wiki=? and page=? and deleted=0", wiki, link)
        if not exists:
            # Also check if it's a valid redirect
            is_redirect = mochi.db.exists("select 1 from redirects where wiki=? and source=?", wiki, link)
            if not is_redirect:
                missing.append(link)
    return missing

# Helper: Create a revision for a page
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
    a.write.stream(s)
    return None

_PERSON_ASSETS = ("avatar", "banner", "favicon", "style", "information")

# Proxy a comment author's person asset from the people service.
def action_comment_asset(a):
    asset = a.input("asset")
    if asset not in _PERSON_ASSETS:
        a.error.label(404, "errors.unknown_asset")
        return
    row = mochi.db.row("select author from comments where id=?", a.input("comment"))
    return stream_asset(a, row["author"] if row else "", "people", asset)

# Proxy a revision author's person asset from the people service.
def action_revision_asset(a):
    asset = a.input("asset")
    if asset not in _PERSON_ASSETS:
        a.error.label(404, "errors.unknown_asset")
        return
    row = mochi.db.row("select author from revisions where id=?", a.input("revision"))
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
    response = mochi.remote.request(link_wiki, "wikis", "information", {"wiki": link_wiki}, link_peer)
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

    # Check if we already have a wiki tracking this source
    existing = mochi.db.row("select * from wikis where source=?", source)
    if existing:
        a.error.label(400, "errors.already_joined_this_wiki")
        return

    # Connect via the share link's peer, the specified server, or directory lookup
    if not peer and server:
        peer = mochi.remote.peer(server)

    # Sync data from the remote wiki first to get the name
    dump = mochi.remote.request(source, "wikis", "sync", {}, peer)
    if dump.get("error") or dump.get("status") != "200":
        a.error.label(500, "errors.failed_to_sync_from_remote_wiki")
        return

    # Get the wiki name from the sync response
    name = dump.get("name") or "Joined Wiki"

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
    if peer:
        mochi.message.send.peer(peer,
            {"from": entity, "to": source, "service": "wikis", "event": "replicate"},
            {"name": name})
    else:
        mochi.message.send(
            {"from": entity, "to": source, "service": "wikis", "event": "replicate"},
            {"name": name}
        )
    mochi.broadcast.touch(source)

    fingerprint = mochi.entity.fingerprint(entity)
    return {"data": {"id": entity, "name": name, "source": source, "fingerprint": fingerprint, "home": dump.get("home") or "home", "message": "Wiki joined successfully"}}

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
    if not wiki.get("source"):
        # This wiki is itself the canonical source — nothing to resync from.
        return {"data": {"synced": False}}
    mochi.db.execute("update wikis set synced=0 where id=?", wiki["id"])
    synced = request_resync(wiki["id"])
    return {"data": {"synced": synced}}

# Revoke a wiki's RSS access tokens (the core tokens, not just the rss rows) so a
# removed wiki's ?token= URL stops authenticating. No-op when the wiki has no RSS
# tokens, so it is safe to call from every wiki-removal path.
def rss_tokens_revoke(entity_id):
    for r in mochi.db.rows("select token from rss where entity=?", entity_id) or []:
        mochi.token.delete(r["token"])
    mochi.db.execute("delete from rss where entity=?", entity_id)

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

    # 5. Delete comments
    mochi.db.execute("delete from comments where wiki=?", wiki_id)

    # 6. Delete replicas
    mochi.db.execute("delete from replicas where wiki=?", wiki_id)

    # 7. Delete RSS tokens (core tokens too, not just the rss rows).
    rss_tokens_revoke(wiki_id)

    # 8. Delete wiki record
    mochi.db.execute("delete from wikis where id=?", wiki_id)

    # 9. Delete all attachments for this entity
    mochi.attachment.clear(wiki_id)

    # 10. Clear access rules
    mochi.access.clear.resource("wiki/" + wiki_id)

    # 11. Delete the entity from the entities table and directory
    mochi.entity.delete(wiki_id)

    # If this was a replica (source set), notify the source to drop us and
    # tombstone it, matching action_unsubscribe - so deleting a replica via
    # this path doesn't strand us in the source's replicas list.
    if wiki["source"]:
        now = mochi.time.now()
        mochi.db.execute("insert or replace into unreplicated (wiki, source, synced) values (?, ?, ?)", wiki_id, wiki["source"], now)
        mochi.message.send({"from": wiki_id, "to": wiki["source"], "service": "wikis", "event": "unreplicate"}, {})

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
        # Anonymous callers (this action is public) run as the host owner, so the
        # query would otherwise return every wiki the owner has, including private
        # ones. Restrict to locally-owned wikis (source='') that grant public view
        # access. Check access with mochi.access.check(None, ...) directly — NOT
        # check_access(), which calls mochi.entity.get() and would treat the
        # thread-local owner as the wiki owner and bypass the access rules.
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
    s = mochi.remote.stream("1JYmMpQU7fxvTrwHpNpiwKCgUg3odWqX7s9t1cLswSMAro5M2P", "recommendations", "list", {"type": "wiki", "language": "en"})
    if not s:
        return {"data": {"wikis": []}}

    r = s.read()
    if not r or r.get("status") != "200":
        return {"data": {"wikis": []}}

    recommendations = []
    items = s.read()
    if type(items) not in ["list", "tuple"]:
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
                "fingerprint": item.get("fingerprint", ""),
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
    wikis_raw = mochi.db.rows("""
        select w.id, w.name, w.home, w.source, w.created,
            (select count(*) from pages p where p.wiki=w.id and p.deleted=0) as pages,
            (select max(p.updated) from pages p where p.wiki=w.id and p.deleted=0) as updated
        from wikis w
    """)
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
        "comment_count": comment_count,
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
        "missing_links": missing_links
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
    if len(slug) > 100:
        a.error.label(400, "errors.url_too_long")
        return
    for c in slug.elems():
        if not (c.isalnum() or c in "-_"):
            a.error.label(400, "errors.page_url_can_only_contain_letters_numbers_hyphens_and_unders")
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
    if len(slug) > 100:
        a.error.label(400, "errors.url_too_long")
        return
    # Validate slug characters (alphanumeric, hyphens, underscores)
    for c in slug.elems():
        if not (c.isalnum() or c in "-_"):
            a.error.label(400, "errors.page_url_can_only_contain_letters_numbers_hyphens_and_unders")
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

    # Check if slug is reserved
    if slug.startswith("-"):
        a.error.label(400, "errors.page_names_starting_with_are_reserved")
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
        create_revision(id, title, content, author, name, version, "Page restored")
    else:
        # Create new page
        id = mochi.uid()
        version = 1
        mochi.db.execute("insert into pages (id, wiki, page, title, content, author, created, updated, version) values (?, ?, ?, ?, ?, ?, ?, ?, 1)",
            id, wiki["id"], slug, title, content, author, now, now)
        create_revision(id, title, content, author, name, 1, "Initial creation")

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

# Parse and clamp limit/offset query parameters for paginated list actions
def pagination(a):
    limit_input = a.input("limit")
    offset_input = a.input("offset")
    limit = int(limit_input) if limit_input != None and str(limit_input).isdigit() else 50
    offset = int(offset_input) if offset_input != None and str(offset_input).isdigit() else 0
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

    page = mochi.db.row("select * from pages where wiki=? and page=?", wiki["id"], slug)
    if not page:
        a.error.label(404, "errors.page_not_found")
        return

    limit, offset = pagination(a)

    total_row = mochi.db.row("select count(*) as cnt from revisions where page=?", page["id"])
    total = total_row["cnt"] if total_row else 0
    revisions = mochi.db.rows("select id, title, author, name, created, version, comment from revisions where page=? order by version desc limit ? offset ?", page["id"], limit, offset)

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

    if not version or not version.isdigit():
        a.error.label(400, "errors.missing_version_parameter")
        return

    page = mochi.db.row("select * from pages where wiki=? and page=?", wiki["id"], slug)
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
            "comment": revision["comment"]
        },
        "current_version": page["version"]
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

    if not version or not version.isdigit():
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
        comment = "Reverted to version " + str(version)

    mochi.db.execute("update pages set title=?, content=?, author=?, updated=?, version=? where id=?",
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

    return {"data": {"slug": slug, "version": newversion, "reverted_from": int(version)}}

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
    if len(new_slug) > 100:
        a.error.label(400, "errors.url_too_long")
        return
    for c in new_slug.elems():
        if not (c.isalnum() or c in "-_"):
            a.error.label(400, "errors.page_url_can_only_contain_letters_numbers_hyphens_and_unders")
            return
    if new_slug.startswith("-"):
        a.error.label(400, "errors.page_names_starting_with_are_reserved")
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
    if len(tag) > 50:
        a.error.label(400, "errors.tag_too_long_max_50_characters")
        return
    # Only allow alphanumeric, hyphens, and underscores
    for c in tag.elems():
        if not (c.isalnum() or c in "-_"):
            a.error.label(400, "errors.invalid_tag")
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

    if len(source) > 100:
        a.error.label(400, "errors.source_too_long")
        return
    if len(target) > 100:
        a.error.label(400, "errors.target_too_long_max_100_characters")
        return

    if source == target:
        a.error.label(400, "errors.source_target_same")
        return

    # Check if source is a reserved path
    if source.startswith("-"):
        a.error.label(400, "errors.cannot_redirect_reserved_paths")
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

    # Send redirect/delete event
    broadcast_event(wiki["id"], "redirect/delete", {
        "source": source
    })

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

    redirects = mochi.db.rows("select source, target, created from redirects where wiki=? order by source", wiki["id"])
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
        if len(value) > 100:
            a.error.label(400, "errors.home_page_slug_too_long_max_100_characters")
            return
        for c in value.elems():
            if not (c.isalnum() or c in "-_/"):
                a.error.label(400, "errors.invalid_home_page")
                return
        mochi.db.execute("update wikis set home=? where id=?", value, wiki["id"])
    else:
        a.error.label(400, "errors.unknown_setting", name=name)
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

    # Broadcast to replicas
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
    mochi.db.execute("delete from comments where wiki=?", wiki_id)
    mochi.db.execute("delete from replicas where wiki=?", wiki_id)
    rss_tokens_revoke(wiki_id)
    mochi.db.execute("delete from wikis where id=?", wiki_id)

    # Clean up attachments, access rules, and entity registration
    mochi.attachment.clear(wiki_id)
    mochi.access.clear.resource("wiki/" + wiki_id)
    mochi.entity.delete(wiki_id)

    # Tombstone the unreplication (keyed by our now-deleted wiki id, recording
    # the source). synced=now so the unreplicate we send below counts as the
    # first attempt; a later dropped broadcast re-sends via unreplicate_stale()
    # if the source missed this one.
    now = mochi.time.now()
    mochi.db.execute("insert or replace into unreplicated (wiki, source, synced) values (?, ?, ?)", wiki_id, wiki["source"], now)

    # Notify source wiki owner to remove us from their replicas list
    mochi.message.send(
        {"from": wiki["id"], "to": wiki["source"], "service": "wikis", "event": "unreplicate"},
        {}
    )

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
        a.error.label(400, "errors.subject_is_required")
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
        a.error.label(400, "errors.subject_is_required")
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
        unreplicate_stale(wiki)
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
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

    # Enforce the same length caps as action_page_edit, so a replica can't push
    # an oversized row that we'd then store and replicate onward.
    if len(title) > 255 or (content and len(content) > 1000000):
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
        unreplicate_stale(wiki)
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
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

    # Enforce the same length caps as action_page_edit, so a replica can't push
    # an oversized row that we'd then store and replicate onward.
    if len(title) > 255 or (content and len(content) > 1000000):
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
        unreplicate_stale(wiki)
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
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
        unreplicate_stale(wiki)
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
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

    # LWW gate: an event whose `created` is no newer than the locally
    # recorded one is a stale duplicate from a concurrent setter on
    # another replica — drop it rather than overwriting our newer state.
    # Same-millisecond ties between hosts let whichever event arrived
    # first stick (rare in practice for user-edited redirects).
    local = mochi.db.row("select created from redirects where wiki=? and source=?", wiki, source)
    if local and local["created"] >= created:
        return

    # Insert or update redirect
    mochi.db.execute("replace into redirects (wiki, source, target, created) values (?, ?, ?, ?)", wiki, source, target, created)

    notify_websocket(wiki)

# Receive redirect/delete event
def event_redirect_delete(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Ensure wiki exists in database
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        unreplicate_stale(wiki)
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    source = e.content("source")

    # Validate required fields
    if not source:
        return

    mochi.db.execute("delete from redirects where wiki=? and source=?", wiki, source)

    notify_websocket(wiki)

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
        # Out-of-order delivery: page hasn't arrived yet. tags.page FK
        # would FK-fail; resync via the wiki header so we converge.
        wiki = e.header("to")
        if wiki:
            request_resync(wiki)
        return

    wiki = pagerow["wiki"]
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        unreplicate_stale(wiki)
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    # Insert tag (ignore if already exists)
    mochi.db.execute("insert or ignore into tags (page, tag) values (?, ?)", page, tag)

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
        unreplicate_stale(wiki)
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    mochi.db.execute("delete from tags where page=? and tag=?", page, tag)

    notify_websocket(wiki)

# Receive setting/set event
def event_setting_set(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Ensure wiki exists in database
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        unreplicate_stale(wiki)
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    # Settings (e.g. home) are owner-level, matching action_settings_set.
    if not replica_can(wikirow, wiki, sender, "manage"):
        return

    name = e.content("name")
    value = e.content("value")

    # Validate required fields
    if not name or value == None:
        return

    # Only allow known settings
    if name == "home":
        mochi.db.execute("update wikis set home=? where id=?", value, wiki)
        notify_websocket(wiki)

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
    # A private wiki's name/fingerprint is only disclosed to a caller with
    # view access - knowing the id (e.g. from a share link) must not reveal it.
    entity = mochi.entity.info(wiki)
    if entity and entity.get("privacy", "public") == "private":
        if not check_event_access(e.header("from"), wiki, "view"):
            e.write({"error": "errors.access_denied", "code": 403})
            return
    e.write({"name": row["name"], "fingerprint": mochi.entity.fingerprint(wiki) or ""})

def event_replicate(e):
    wiki = e.header("to")
    if not wiki:
        return

    # Get the replica's entity ID from the message header
    replica = e.header("from")
    if not replica:
        return

    # Get optional name from content
    name = e.content("name") or ""

    now = mochi.time.now()

    # Use UPSERT to handle concurrent replicate requests atomically. The core
    # per-user directory learns the replica's route from this (claim-verified)
    # registration, so no peer is stored on the row.
    mochi.db.execute("""insert into replicas (wiki, id, name, subscribed, seen, synced) values (?, ?, ?, ?, 0, 0)
        on conflict(wiki, id) do update set name=excluded.name""",
        wiki, replica, name, now)

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
    comments = mochi.db.rows("select * from comments where wiki=? and deleted=0", wiki)
    wikirow = mochi.db.row("select name, home from wikis where id=?", wiki)
    attachments = mochi.attachment.list(wiki) or []

    # Include comment-level attachments in each comment
    for c in comments:
        c_atts = mochi.attachment.list(c["id"]) or []
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

# Handle remote page edit request from a replica (stream-based)
def event_page_edit_request(e):
    wiki = e.header("to")
    if not wiki:
        e.write({"status": "400", "error": "Missing wiki ID"})
        return

    # Verify wiki exists and is a source wiki (not a replica)
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        e.write({"status": "404", "error": "Wiki not found"})
        return

    if wikirow.get("source"):
        e.write({"status": "400", "error": "Cannot edit a replica wiki remotely"})
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

# Handle remote page delete request from a replica (stream-based)
def event_page_delete_request(e):
    wiki = e.header("to")
    if not wiki:
        e.write({"status": "400", "error": "Missing wiki ID"})
        return

    # Verify wiki exists and is a source wiki (not a replica)
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        e.write({"status": "404", "error": "Wiki not found"})
        return

    if wikirow.get("source"):
        e.write({"status": "400", "error": "Cannot delete from a replica wiki remotely"})
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

    # Broadcast delete event to replicas
    broadcast_event(wiki, "page/delete", {
        "id": page["id"],
        "deleted": now,
        "version": version,
    })

    e.write({"status": "200", "deleted": slug})

# Handle remote attachment upload request from a replica (stream-based)
def event_attachment_upload_request(e):
    wiki = e.header("to")
    if not wiki:
        e.write({"status": "400", "error": "Missing wiki ID"})
        return

    # Verify wiki exists and is a source wiki (not a replica)
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        e.write({"status": "404", "error": "Wiki not found"})
        return

    if wikirow.get("source"):
        e.write({"status": "400", "error": "Cannot upload to a replica wiki remotely"})
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

    # Get replicas for notification
    replicas = mochi.db.rows("select id from replicas where wiki=? and id!=?", wiki, wiki)
    notify = [r["id"] for r in replicas]

    # Stream directly to attachment storage (no temp file needed)
    attachment = mochi.attachment.create.stream(wiki, name, e.stream, content_type, "", "", notify)

    if not attachment:
        e.write({"status": "500", "error": "Failed to create attachment"})
        return

    e.write({"status": "200", "attachment": attachment})

# Handle attachment/create event - replica notifies source that they uploaded an attachment
# Source fetches the file from replica via stream and saves locally
def event_attachment_create(e):
    wiki = e.header("to")
    mochi.log.info("attachment/create: to=%s", wiki)
    if not wiki:
        mochi.log.info("attachment/create: no wiki header, returning")
        return

    # Verify wiki exists and is a source wiki (not a replica)
    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        mochi.log.info("attachment/create: wiki not found in db")
        return

    if wikirow.get("source"):
        mochi.log.info("attachment/create: wiki is replica, ignoring")
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        mochi.log.info("attachment/create: sender %s not valid", sender)
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        mochi.log.info("attachment/create: sender %s lacks edit access", sender)
        return

    # Get attachment metadata from event content
    attachment_id = e.content("id")
    name = e.content("name")
    size = e.content("size")
    content_type = e.content("content_type") or ""
    created = e.content("created")
    replica = e.content("replica")

    mochi.log.info("attachment/create: id=%s name=%s replica=%s", attachment_id, name, replica)

    if not attachment_id or not name or not replica:
        mochi.log.info("attachment/create: missing required fields")
        return

    # Validate timestamp is within reasonable range (not more than 1 day in future or 1 year in past)
    if created:
        now = mochi.time.now()
        if created > now + 86400 or created < now - 31536000:
            mochi.log.info("attachment/create: timestamp out of range: %s", created)
            return

    # Check if we already have this attachment
    if mochi.attachment.exists(attachment_id):
        mochi.log.info("attachment/create: attachment %s already exists, skipping", attachment_id)
        return

    mochi.log.info("Fetching attachment %s from replica %s", attachment_id, replica)

    # Look up peer for the replica (private entities can't be resolved via directory)
    replica_row = mochi.db.row("select peer from replicas where wiki=? and id=?", wiki, replica)
    peer = replica_row["peer"] if replica_row else ""

    # Open stream to replica to fetch the file data
    if peer:
        stream = mochi.stream.peer(
            peer,
            {"from": wiki, "to": replica, "service": "wikis", "event": "attachment/fetch"},
            {"id": attachment_id}
        )
    else:
        stream = mochi.stream(
            {"from": wiki, "to": replica, "service": "wikis", "event": "attachment/fetch"},
            {"id": attachment_id}
        )

    if not stream:
        mochi.log.error("Failed to open stream to replica %s (peer=%s)", replica, peer)
        return

    # Read response status first
    response = stream.read()
    mochi.log.debug("Fetch response: %s", response)
    if not response or response.get("status") != "200":
        mochi.log.error("Failed to fetch attachment %s from replica %s: %s",
            attachment_id, replica, response.get("error") if response else "no response")
        return

    # Get replicas for notification (excluding the one who uploaded)
    replicas = mochi.db.rows("select id from replicas where wiki=? and id!=?", wiki, replica)
    notify = [r["id"] for r in replicas]

    # Stream directly to attachment storage with the original ID (no temp file needed)
    attachment = mochi.attachment.create.stream(wiki, name, stream, content_type, "", "", notify, attachment_id)

    if attachment:
        mochi.log.debug("Created attachment %s from replica %s", attachment_id, replica)
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
        unreplicate_stale(wiki)
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

    # Delete locally and broadcast removal to other replicas
    mochi.attachment.delete(attachment_id, [])
    broadcast_event(wiki, "attachment/remove", {"id": attachment_id}, exclude=sender)
    mochi.log.debug("Deleted attachment %s from replica %s", attachment_id, sender)
    notify_websocket(wiki)

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
    bytes_written = e.write.file(path)
    mochi.log.debug("attachment/fetch sent %s bytes", bytes_written)

# P2P event: attachment/add — store remote attachment metadata (files pulled on demand)
def event_attachment_add(e):
    wiki = e.header("to")
    if not wiki:
        return

    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        unreplicate_stale(wiki)
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    attachments = e.content("attachments") or []
    if attachments:
        source = wikirow.get("source") or sender
        mochi.attachment.store(attachments, source, wiki)

    notify_websocket(wiki)

# P2P event: attachment/remove — delete attachment metadata
def event_attachment_remove(e):
    wiki = e.header("to")
    if not wiki:
        return

    wikirow = mochi.db.row("select * from wikis where id=?", wiki)
    if not wikirow:
        unreplicate_stale(wiki)
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    attachment_id = e.content("id")
    if attachment_id:
        mochi.attachment.delete(attachment_id, [])

    notify_websocket(wiki)

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

    # Import comments
    comments = dump.get("comments") or []
    for c in comments:
        mochi.db.execute("replace into comments (id, wiki, page, parent, author, name, body, created, edited, deleted) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            c["id"], wiki, c["page"], c.get("parent", ""), c["author"], c.get("name", ""), c["body"], c["created"], c.get("edited", 0), c.get("deleted", 0))

    # Import wiki name and home setting
    name = dump.get("name")
    home = dump.get("home")
    if name or home:
        mochi.db.execute("update wikis set name=?, home=? where id=?",
            name or "", home or "home", wiki)

    # Store attachment metadata from sync dump (files pulled on demand)
    source = dump.get("source")
    if source:
        attachments = dump.get("attachments") or []
        if attachments:
            mochi.attachment.store(attachments, source, wiki)
        for c in comments:
            c_atts = c.get("attachments") or []
            if c_atts:
                mochi.attachment.store(c_atts, source, c["id"])

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

    # Get target wiki entity to subscribe to
    target = a.input("target")
    if not target:
        a.error.label(400, "errors.target_wiki_entity_is_required")
        return

    # Send replicate request to target
    mochi.message.send(
        {"from": wiki["id"], "to": target, "service": "wikis", "event": "replicate"},
        {"name": a.user.identity.name or ""}
    )

    return {"data": {"ok": True, "message": "Replication request sent"}}

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

    # Use stored server for the wiki, or accept override
    server = a.input("server") or wiki.get("server")
    peer = None
    if server:
        peer = mochi.remote.peer(server)
        if not peer:
            a.error.label(502, "errors.unable_to_connect_to_server")
            return

    # Request sync from target
    dump = mochi.remote.request(target, "wikis", "sync", {}, peer)
    if dump.get("error") or not dump:
        a.error.label(500, "errors.failed_to_receive_sync_data")
        return

    # Import the dump (includes attachments with remote entity reference)
    if not import_sync_dump(wiki["id"], dump):
        a.error.label(500, "errors.failed_to_import_sync_data")
        return

    # Subscribe to the source wiki for future updates
    mochi.message.send(
        {"from": wiki["id"], "to": target, "service": "wikis", "event": "replicate"},
        {"name": wiki.get("name") or ""}
    )

    return {"data": {"ok": True, "message": "Sync completed successfully"}}

# COMMENTS

# Helper: Build comment tree recursively for a page
def page_comments(wiki_id, page_slug, parent_id, depth):
    if depth > 100:
        return []
    comments = mochi.db.rows("select * from comments where wiki=? and page=? and parent=? and deleted=0 order by created desc", wiki_id, page_slug, parent_id)
    for i in range(len(comments)):
        comments[i]["body_markdown"] = mochi.text.markdown(comments[i]["body"])
        comments[i]["children"] = page_comments(wiki_id, page_slug, comments[i]["id"], depth + 1)
        comments[i]["attachments"] = mochi.attachment.list(comments[i]["id"], wiki_id) or []
    return comments

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
        for child in mochi.db.rows("select id from comments where parent=?", pending[i]):
            pending.append(child["id"])
        i += 1
    for cid in pending:
        for att in (mochi.attachment.list(cid, wiki_id) or []):
            mochi.attachment.delete(att["id"])
        mochi.db.execute("delete from comments where id=?", cid)

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

    comments = page_comments(wiki["id"], slug, "", 0)
    count = page_comment_count(wiki["id"], slug)
    return {"data": {"comments": comments, "count": count}}

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

    mochi.db.execute("insert into comments (id, wiki, page, parent, author, name, body, created) values (?, ?, ?, ?, ?, ?, ?, ?)",
        id, wiki["id"], slug, parent, author, name, body, now)

    # Save attachments (no push notification — metadata piggybacked on event)
    attachments = mochi.attachment.save(id, "files", [], [], []) or []
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
    mochi.db.execute("update comments set body=?, edited=? where id=?", body, now, id)

    data = {
        "id": id,
        "wiki": wiki["id"],
        "page": comment["page"],
        "body": body,
        "edited": now,
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

    # Only the author or wiki owner can delete
    is_owner = bool(mochi.entity.get(wiki["id"]))
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
        unreplicate_stale(wiki)
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
    body = e.content("body")
    created = e.content("created")

    if not id or not page or not author or not body or not created:
        return

    # Enforce the same cap as action_comment_create, so a replica can't push an
    # oversized comment that we'd then store and replicate onward.
    if len(body) > 100000:
        return

    mochi.db.execute("insert or ignore into comments (id, wiki, page, parent, author, name, body, created) values (?, ?, ?, ?, ?, ?, ?, ?)",
        id, wiki, page, parent, author, name, body, created)

    # Store comment attachments from event (files pulled on demand)
    attachments = e.content("attachments") or []
    source = wikirow.get("source") or sender
    if attachments:
        mochi.attachment.store(attachments, source, id)

    # Re-broadcast if we are the source wiki
    if not wikirow.get("source") and sender:
        rebroadcast = {
            "id": id,
            "page": page,
            "parent": parent,
            "author": author,
            "name": name,
            "body": body,
            "created": created,
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
        unreplicate_stale(wiki)
        return

    sender = e.header("from")
    if not validate_event_sender(wikirow, wiki, sender):
        return
    if not replica_can(wikirow, wiki, sender, "edit"):
        return

    id = e.content("id")
    body = e.content("body")
    edited = e.content("edited")

    if not id or not body or not edited:
        return

    # LWW gate: skip if our locally-stored edit is at least as new.
    # `edited` is 0 for never-edited comments, so the first edit always
    # wins over the create-time state.
    local = mochi.db.row("select edited from comments where id=? and wiki=?", id, wiki)
    if not local:
        request_resync(wiki)
        return
    if local["edited"] >= edited:
        return

    mochi.db.execute("update comments set body=?, edited=? where id=? and wiki=?", body, edited, id, wiki)

    # Re-broadcast if we are the source wiki
    if not wikirow.get("source") and sender:
        broadcast_event(wiki, "comment/edit", {
            "id": id,
            "wiki": wiki,
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
        unreplicate_stale(wiki)
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

# HTTP handlers serving a wiki's attachments (and thumbnails). Public routes,
# so anonymous viewers can load a public wiki's attachments; access is enforced
# here on a.user, never on ambient ownership. Core's a.write.attachment serves
# the bytes with no access check of its own, so this handler is the gate: it
# reuses the action_attachments view check and additionally binds the
# attachment to this wiki (attached to the wiki itself or to one of its
# comments), so one wiki's attachment can't be fetched via another wiki's route.
def action_attachment(a):
    serve_attachment(a, False)

def action_attachment_thumbnail(a):
    serve_attachment(a, True)

def serve_attachment(a, thumbnail):
    attachment = a.input("id")
    wiki = get_wiki(a)
    if wiki and not wiki.get("source", ""):
        # We own this wiki: enforce view access, then bind the attachment.
        if not check_access(a, wiki["id"], "view"):
            a.error.label(403, "errors.access_denied")
            return
        att = mochi.attachment.get(attachment)
        if not att:
            a.error.label(404, "errors.attachment_not_found")
            return
        obj = att.get("object")
        if obj != wiki["id"] and not mochi.db.exists("select 1 from comments where id=? and wiki=?", obj, wiki["id"]):
            a.error.label(404, "errors.attachment_not_found")
            return
    # Replica/remote wikis: the source enforces access when a.write.attachment
    # fetches over P2P, and per-user databases isolate one local user's replica
    # from another.
    a.write.attachment(attachment, thumbnail=thumbnail)

# List all wiki attachments
def action_attachments(a):
    wiki = get_wiki(a)
    if not wiki:
        a.error.label(404, "errors.wiki_not_found")
        return

    if not check_access(a, wiki["id"], "view"):
        a.error.label(403, "errors.access_denied")
        return

    # For replica wikis, list attachments from both source and local entity
    source = wiki.get("source")
    attachments = list(mochi.attachment.list(wiki["id"], wiki["id"]) or [])
    if source and source != wiki["id"]:
        source_attachments = mochi.attachment.list(source, wiki["id"]) or []
        existing = {a["id"]: True for a in attachments}
        for sa in source_attachments:
            if sa["id"] not in existing:
                attachments.append(sa)
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
        attachments = mochi.attachment.save(wiki["id"], "files", [], [], [])
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
    attachments = mochi.attachment.save(wiki["id"], "files", [], [], [])

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

    # Delete locally (no push notification — metadata piggybacked)
    if not mochi.attachment.delete(id, []):
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
        new_content = remove_attachment_refs(page["content"], id)
        if new_content != page["content"]:
            # Use atomic version increment to prevent race conditions
            mochi.db.execute("update pages set content=?, author=?, updated=?, version=version+1 where id=?",
                new_content, author, now, page["id"])
            version = mochi.db.row("select version from pages where id=?", page["id"])["version"]
            create_revision(page["id"], page["title"], new_content, author, name, version, "Removed deleted attachment")
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

    # Check existing token
    existing = mochi.db.row("select token from rss where entity=? and mode=?", wiki_id, mode)
    if existing:
        return {"data": {"token": existing["token"]}}

    # Create new token
    token = mochi.token.create("rss", ["rss"])
    if not token:
        a.error.label(500, "errors.failed_to_create_token")
        return

    now = mochi.time.now()
    mochi.db.execute("insert into rss (token, entity, mode, created) values (?, ?, ?, ?)", token, wiki_id, mode, now)
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
        rss_row = mochi.db.row("select mode from rss where token=? and entity=?", token, wiki["id"])
        if rss_row:
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
            title = "Comment on \"" + row["title"] + "\" by " + row["name"]
            desc = row["description"]
            if len(desc) > 500:
                desc = desc[:500] + "..."
        else:
            title = "\"" + row["title"] + "\" edited by " + row["name"]
            desc = row["description"] if row["description"] else "Version " + str(row["version"])

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
        rss_row = mochi.db.row("select mode from rss where token=? and entity='*'", token)
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
            title = wiki_name + ": Comment on \"" + row["title"] + "\" by " + row["name"]
            desc = row["description"]
            if len(desc) > 500:
                desc = desc[:500] + "..."
        else:
            title = wiki_name + ": \"" + row["title"] + "\" edited by " + row["name"]
            desc = row["description"] if row["description"] else "Version " + str(row["version"])

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
