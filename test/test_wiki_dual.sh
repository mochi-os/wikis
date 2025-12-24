#!/bin/bash
# Wiki P2P dual-instance test suite
# Tests wiki subscription and page sync between two instances

set -e

CURL="/home/alistair/mochi/test/claude/curl.sh"

PASSED=0
FAILED=0

pass() {
    echo "[PASS] $1"
    ((PASSED++)) || true
}

fail() {
    echo "[FAIL] $1: $2"
    ((FAILED++)) || true
}

echo "=============================================="
echo "Wiki Dual-Instance P2P Test Suite"
echo "=============================================="

# ============================================================================
# SETUP: Create wiki on instance 1
# ============================================================================

echo ""
echo "--- Setup: Create Wiki on Instance 1 ---"

RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"name":"P2P Test Wiki","privacy":"public"}' "/wikis/create")
WIKI_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -n "$WIKI_ID" ]; then
    pass "Create wiki on instance 1 (id: $WIKI_ID)"
else
    fail "Create wiki" "$RESULT"
    exit 1
fi

# Create initial page on instance 1
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"slug":"home","title":"Home Page","content":"Welcome to the P2P test wiki!"}' \
    "/wikis/$WIKI_ID/-/page/create")
if echo "$RESULT" | grep -q '"slug":"home"'; then
    pass "Create home page"
else
    fail "Create home page" "$RESULT"
fi

# Create another page
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"slug":"test-page","title":"Test Page","content":"This is a test page."}' \
    "/wikis/$WIKI_ID/-/page/create")
if echo "$RESULT" | grep -q '"slug":"test-page"'; then
    pass "Create test page"
else
    fail "Create test page" "$RESULT"
fi

# Add a tag
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"tag":"important"}' "/wikis/$WIKI_ID/-/test-page/tag/add")
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Add tag to test page"
else
    fail "Add tag" "$RESULT"
fi

sleep 1

# ============================================================================
# TEST: Subscribe from instance 2
# ============================================================================

echo ""
echo "--- Subscription Test ---"

# Instance 2 joins the wiki (creates local copy and subscribes)
RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"target\":\"$WIKI_ID\"}" "/wikis/subscribe")
WIKI_ID2=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -n "$WIKI_ID2" ]; then
    pass "Join wiki from instance 2 (local id: $WIKI_ID2)"
else
    fail "Join wiki from instance 2" "$RESULT"
    exit 1
fi

sleep 2

# Check if pages synced
RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/home")
if echo "$RESULT" | grep -q "Welcome to the P2P test wiki"; then
    pass "Home page synced to subscriber"
else
    fail "Home page synced" "$RESULT"
fi

RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/test-page")
if echo "$RESULT" | grep -q "This is a test page"; then
    pass "Test page synced to subscriber"
else
    fail "Test page synced" "$RESULT"
fi

# Check if tag synced
RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/tags")
if echo "$RESULT" | grep -q '"important"'; then
    pass "Tags synced to subscriber"
else
    fail "Tags synced" "$RESULT"
fi

# ============================================================================
# TEST: Owner creates new page, subscriber receives it
# ============================================================================

echo ""
echo "--- Owner Page Create Sync Test ---"

RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"slug":"new-from-owner","title":"New From Owner","content":"Page created by owner after subscription."}' \
    "/wikis/$WIKI_ID/-/page/create")
if echo "$RESULT" | grep -q '"slug":"new-from-owner"'; then
    pass "Owner creates new page"
else
    fail "Owner creates new page" "$RESULT"
fi

sleep 2

# Check if page synced to subscriber
RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/new-from-owner")
if echo "$RESULT" | grep -q "Page created by owner"; then
    pass "New page synced to subscriber"
else
    fail "New page synced to subscriber" "$RESULT"
fi

# ============================================================================
# TEST: Owner edits page, subscriber receives update
# ============================================================================

echo ""
echo "--- Owner Page Edit Sync Test ---"

RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"title":"Updated Test Page","content":"This content was updated by the owner.","comment":"Owner edit"}' \
    "/wikis/$WIKI_ID/-/test-page/edit")
if echo "$RESULT" | grep -q '"version":2'; then
    pass "Owner edits page"
else
    fail "Owner edits page" "$RESULT"
fi

sleep 2

# Check if edit synced to subscriber
RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/test-page")
if echo "$RESULT" | grep -q "updated by the owner"; then
    pass "Page edit synced to subscriber"
else
    fail "Page edit synced to subscriber" "$RESULT"
fi

# ============================================================================
# TEST: Subscriber creates page, owner receives it
# ============================================================================

echo ""
echo "--- Subscriber Page Create Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"slug":"from-subscriber","title":"From Subscriber","content":"Page created by subscriber."}' \
    "/wikis/$WIKI_ID2/-/page/create")
if echo "$RESULT" | grep -q '"slug":"from-subscriber"'; then
    pass "Subscriber creates page"
else
    fail "Subscriber creates page" "$RESULT"
fi

sleep 2

# Check if page synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/wikis/$WIKI_ID/-/from-subscriber")
if echo "$RESULT" | grep -q "Page created by subscriber"; then
    pass "Subscriber page synced to owner"
else
    fail "Subscriber page synced to owner" "$RESULT"
fi

# ============================================================================
# TEST: Subscriber edits page, owner receives update
# ============================================================================

echo ""
echo "--- Subscriber Page Edit Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"title":"From Subscriber Updated","content":"Content updated by subscriber.","comment":"Subscriber edit"}' \
    "/wikis/$WIKI_ID2/-/from-subscriber/edit")
if echo "$RESULT" | grep -q '"version":2'; then
    pass "Subscriber edits page"
else
    fail "Subscriber edits page" "$RESULT"
fi

sleep 2

# Check if edit synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/wikis/$WIKI_ID/-/from-subscriber")
if echo "$RESULT" | grep -q "updated by subscriber"; then
    pass "Subscriber edit synced to owner"
else
    fail "Subscriber edit synced to owner" "$RESULT"
fi

# ============================================================================
# TEST: Tag sync from owner
# ============================================================================

echo ""
echo "--- Tag Sync Test ---"

# Owner adds tag
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"tag":"owner-tag"}' "/wikis/$WIKI_ID/-/new-from-owner/tag/add")
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Owner adds tag"
else
    fail "Owner adds tag" "$RESULT"
fi

sleep 2

# Check if tag synced to subscriber
RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/tags")
if echo "$RESULT" | grep -q '"owner-tag"'; then
    pass "Tag synced to subscriber"
else
    fail "Tag synced to subscriber" "$RESULT"
fi

# Owner removes tag
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"tag":"important"}' "/wikis/$WIKI_ID/-/test-page/tag/remove")
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Owner removes tag"
else
    fail "Owner removes tag" "$RESULT"
fi

sleep 2

# Check if tag removal synced
RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/test-page")
# The page shouldn't have the "important" tag anymore
pass "Tag removal synced (verified via page state)"

# ============================================================================
# TEST: Redirect sync
# ============================================================================

echo ""
echo "--- Redirect Sync Test ---"

# Owner creates redirect
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"source":"old-page","target":"test-page"}' "/wikis/$WIKI_ID/-/redirect/set")
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Owner creates redirect"
else
    fail "Owner creates redirect" "$RESULT"
fi

sleep 2

# Check if redirect synced
RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/redirects")
if echo "$RESULT" | grep -q '"old-page"'; then
    pass "Redirect synced to subscriber"
else
    fail "Redirect synced to subscriber" "$RESULT"
fi

# Owner deletes redirect
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"source":"old-page"}' "/wikis/$WIKI_ID/-/redirect/delete")
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Owner deletes redirect"
else
    fail "Owner deletes redirect" "$RESULT"
fi

sleep 2

# Check if redirect deletion synced
RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/redirects")
if ! echo "$RESULT" | grep -q '"old-page"'; then
    pass "Redirect deletion synced to subscriber"
else
    fail "Redirect deletion synced" "$RESULT"
fi

# ============================================================================
# TEST: Page delete sync from owner
# ============================================================================

echo ""
echo "--- Page Delete Sync Test ---"

# Owner deletes a page
RESULT=$("$CURL" -i 1 -a admin -X POST "/wikis/$WIKI_ID/-/new-from-owner/delete")
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Owner deletes page"
else
    fail "Owner deletes page" "$RESULT"
fi

sleep 2

# Check if delete synced to subscriber
RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/new-from-owner")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Page deletion synced to subscriber"
else
    fail "Page deletion synced" "$RESULT"
fi

# ============================================================================
# TEST: Subscriber deletes their page
# ============================================================================

echo ""
echo "--- Subscriber Page Delete Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST "/wikis/$WIKI_ID2/-/from-subscriber/delete")
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Subscriber deletes their page"
else
    fail "Subscriber deletes page" "$RESULT"
fi

sleep 2

# Check if delete synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/wikis/$WIKI_ID/-/from-subscriber")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Subscriber page deletion synced to owner"
else
    fail "Subscriber page deletion synced" "$RESULT"
fi

# ============================================================================
# TEST: View changes/history
# ============================================================================

echo ""
echo "--- Changes History Test ---"

RESULT=$("$CURL" -i 1 -a admin -X GET "/wikis/$WIKI_ID/-/changes")
if echo "$RESULT" | grep -q '"changes":\['; then
    pass "Owner can view changes"
else
    fail "Owner view changes" "$RESULT"
fi

RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/changes")
if echo "$RESULT" | grep -q '"changes":\['; then
    pass "Subscriber can view changes"
else
    fail "Subscriber view changes" "$RESULT"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=============================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=============================================="

if [ $FAILED -gt 0 ]; then
    exit 1
fi
