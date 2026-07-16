#!/usr/bin/env python3
# Copyright © 2026 Mochisoft OÜ
# SPDX-License-Identifier: AGPL-3.0-only
# This file is part of Mochi, licensed under the GNU AGPL v3 with the
# Mochi Application Interface Exception - see license.txt and license-exception.md.

# Wikis unreplicate-tombstone test (dual-identity, instance 2).
#
# Validates the stale-roster cleanup: when a replica unsubscribes but its
# unreplicate is lost (source offline), a later dropped broadcast re-sends the
# unreplicate to the RECORDED source via the unreplicated tombstone, so the
# source prunes the dead replica. Asserts on real wikis.db state.
#
# Topology: admin (dev1) sources a wiki; user (dev21=019eb703) joins it as a
# replica. Both on instance 2 (port 8082); P2P loops back but every handler runs.
import json, subprocess, sqlite3, sys, time, urllib.request, urllib.error

SCRIPTS = "/home/alistair/mochi/claude/scripts"
BASE = "http://localhost:8082"
A_DB = "/home/alistair/var/lib/mochi2/users/019e1cbd71717540b521a47389bae022/wikis/db/wikis.db"
B_DB = "/home/alistair/var/lib/mochi2/users/019eb703954879d6bf9d3c6da1a80f3e/wikis/db/wikis.db"

passed = failed = 0
def check(ok, name, detail=""):
    global passed, failed
    if ok: passed += 1; print(f"[PASS] {name}")
    else:  failed += 1; print(f"[FAIL] {name}: {detail}")

def jwt(role):
    s = subprocess.check_output([f"{SCRIPTS}/get-token.sh", role, "2"]).decode().strip()
    r = urllib.request.Request(f"{BASE}/_/token", data=json.dumps({"app": "wikis"}).encode(),
                               headers={"Content-Type": "application/json", "Cookie": f"session={s}"})
    return json.load(urllib.request.urlopen(r))["token"]
A_JWT, B_JWT = jwt("admin"), jwt("user")

def call(role, method, path, body=None):
    tok = A_JWT if role == "admin" else B_JWT
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{BASE}{path}", data=data, method=method,
                               headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        try: return json.load(e)
        except Exception: return {"_http": e.code}

def dbq(path, q, args=()):
    c = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try: return c.execute(q, args).fetchall()
    finally: c.close()

def has_replica(wiki, rid):
    return bool(dbq(A_DB, "select 1 from replicas where wiki=? and id=?", (wiki, rid)))
def b_replica_of(source):
    r = dbq(B_DB, "select id from wikis where source=?", (source,))
    return r[0][0] if r else None
def b_tombstone(rid):
    r = dbq(B_DB, "select source from unreplicated where wiki=?", (rid,))
    return r[0][0] if r else None

print("=== T1: migration (schema 16 + unreplicated table) ===")
# Touch both DBs through a real action so the migration runs.
call("admin", "POST", "/wikis/-/create", {"name": "warmup-a"})
call("user", "POST", "/wikis/-/create", {"name": "warmup-b"})
time.sleep(1)
for label, p in (("A", A_DB), ("B", B_DB)):
    ver = dbq(p, "pragma user_version")[0][0]
    tbl = bool(dbq(p, "select 1 from sqlite_master where type='table' and name='unreplicated'"))
    check(ver >= 16 and tbl, f"{label}: schema {ver}>=16 + unreplicated table", f"ver={ver} tbl={tbl}")

print("=== T2: A sources a wiki, B joins as replica ===")
W = call("admin", "POST", "/wikis/-/create", {"name": "Shared Wiki"}).get("data", {}).get("id") \
    or call("admin", "POST", "/wikis/-/create", {"name": "Shared Wiki"}).get("data", {}).get("wiki")
check(bool(W), "A created source wiki", W)
time.sleep(1)
call("user", "POST", "/wikis/-/subscribe", {"target": W})
time.sleep(3)
R = b_replica_of(W)
check(bool(R), "B created a local replica (source=W)", R)
check(has_replica(W, R) if R else False, "A registered B's replica in replicas table")

print("=== T3: A edits -> broadcast reaches the replica ===")
call("admin", "POST", f"/wikis/{W}/-/page/create", {"slug": "home", "title": "Home", "content": "hello replicas"})
time.sleep(3)
pages = dbq(B_DB, "select title from pages where wiki=?", (R,)) if R else []
check(any("Home" in p[0] for p in pages), "B's replica received the page (broadcast)", pages)

print("=== T4: B unsubscribes -> source pruned + tombstone recorded ===")
call("user", "POST", f"/wikis/{R}/-/unsubscribe", {"wiki": R})
time.sleep(3)
check(not has_replica(W, R), "A: replica pruned via unsubscribe (event_unreplicate)")
check(b_replica_of(W) is None, "B: local replica wiki gone")
check(b_tombstone(R) == W, "B: unreplicate tombstone recorded (R -> W)", b_tombstone(R))

print("=== T5: stale-roster backstop (lost unreplicate -> unreplicate_stale) ===")
# Re-join to repopulate A's replicas, then simulate the unsubscribe's unreplicate
# being LOST: drop B's replica wiki + tombstone it directly, WITHOUT notifying A.
call("user", "POST", "/wikis/-/subscribe", {"target": W})
time.sleep(3)
R2 = b_replica_of(W)
check(bool(R2) and has_replica(W, R2), "T5 setup: re-joined, A has replica R2", R2)
w = sqlite3.connect(B_DB, timeout=10)
w.execute("delete from pages where wiki=?", (R2,))
w.execute("delete from wikis where id=?", (R2,))
w.execute("insert or replace into unreplicated (wiki, source, synced) values (?, ?, 0)", (R2, W))
w.commit(); w.close()
check(b_replica_of(W) is None and b_tombstone(R2) == W, "T5 setup: B injected lost-unreplicate state")
# A edits again -> broadcast fans to R2 -> B drops (no wiki) -> unreplicate_stale
# re-sends unreplicate to W -> A prunes R2.
call("admin", "POST", f"/wikis/{W}/-/page/create", {"slug": "second", "title": "Second", "content": "ping the ghost replica"})
time.sleep(3)
check(not has_replica(W, R2), "A: stale replica R2 pruned via unreplicate_stale backstop")

print(f"\n=== Results: {passed} passed, {failed} failed ===")
sys.exit(1 if failed else 0)
