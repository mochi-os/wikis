#!/bin/bash
# Wiki P2P non-subscriber test suite
# Tests access model: wikis require joining (local copy) for full interaction
#
# Unlike forums/feeds where non-subscribers can interact with public content,
# wikis require users to "join" (create a local replica) for full access.
# This test demonstrates that model.

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
echo "Wiki Access Model Test Suite"
echo "=============================================="

# ============================================================================
# SETUP: Create wiki on instance 1 with pages
# ============================================================================

echo ""
echo "--- Setup: Create Wiki on Instance 1 ---"

RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"name":"Access Model Test Wiki","privacy":"public"}' "/wikis/create")
WIKI_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -n "$WIKI_ID" ]; then
    pass "Create wiki on instance 1 (id: $WIKI_ID)"
else
    fail "Create wiki" "$RESULT"
    exit 1
fi

# Create pages
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"slug":"home","title":"Home Page","content":"Welcome to the wiki!"}' \
    "/wikis/$WIKI_ID/-/page/create")
if echo "$RESULT" | grep -q '"slug":"home"'; then
    pass "Create home page"
else
    fail "Create home page" "$RESULT"
fi

RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"slug":"test-page","title":"Test Page","content":"Test content."}' \
    "/wikis/$WIKI_ID/-/page/create")
if echo "$RESULT" | grep -q '"slug":"test-page"'; then
    pass "Create test page"
else
    fail "Create test page" "$RESULT"
fi

sleep 1

# ============================================================================
# TEST: Without joining, instance 2 cannot access wiki directly
# ============================================================================

echo ""
echo "--- Direct Access Without Joining Test ---"

# Instance 2 tries to access pages directly (should fail - no local wiki)
RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID/-/home")
if echo "$RESULT" | grep -q 'Wiki not found\|Error 404'; then
    pass "Direct access blocked without joining"
else
    fail "Direct access should be blocked" "$RESULT"
fi

# Instance 2 tries to create page (should fail)
RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"slug":"remote-page","title":"Remote Page","content":"Should fail."}' \
    "/wikis/$WIKI_ID/-/page/create")
if echo "$RESULT" | grep -q 'Wiki not found\|Error\|error'; then
    pass "Page creation blocked without joining"
else
    fail "Page creation should be blocked" "$RESULT"
fi

# ============================================================================
# TEST: After joining, instance 2 has full access
# ============================================================================

echo ""
echo "--- Join and Access Test ---"

# Instance 2 joins the wiki
RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"target\":\"$WIKI_ID\"}" "/wikis/subscribe")
WIKI_ID2=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -n "$WIKI_ID2" ]; then
    pass "Join wiki creates local copy (id: $WIKI_ID2)"
else
    fail "Join wiki" "$RESULT"
    exit 1
fi

sleep 2

# Now can view pages
RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/home")
if echo "$RESULT" | grep -q "Welcome to the wiki"; then
    pass "View home page after joining"
else
    fail "View home page after joining" "$RESULT"
fi

RESULT=$("$CURL" -i 2 -a admin -X GET "/wikis/$WIKI_ID2/-/test-page")
if echo "$RESULT" | grep -q "Test content"; then
    pass "View test page after joining"
else
    fail "View test page after joining" "$RESULT"
fi

# ============================================================================
# TEST: Joined user can create pages
# ============================================================================

echo ""
echo "--- Joined User Create Page Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"slug":"joined-page","title":"Joined Page","content":"Created after joining."}' \
    "/wikis/$WIKI_ID2/-/page/create")
if echo "$RESULT" | grep -q '"slug":"joined-page"'; then
    pass "Create page after joining"
else
    fail "Create page after joining" "$RESULT"
fi

sleep 2

# Verify page synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/wikis/$WIKI_ID/-/joined-page")
if echo "$RESULT" | grep -q "Created after joining"; then
    pass "Joined user's page synced to owner"
else
    fail "Page synced to owner" "$RESULT"
fi

# ============================================================================
# TEST: Joined user can edit pages
# ============================================================================

echo ""
echo "--- Joined User Edit Page Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"title":"Test Page Edited","content":"Content edited by joined user.","comment":"Joined user edit"}' \
    "/wikis/$WIKI_ID2/-/test-page/edit")
if echo "$RESULT" | grep -q '"version":2'; then
    pass "Edit page after joining"
else
    fail "Edit page after joining" "$RESULT"
fi

sleep 2

# Verify edit synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/wikis/$WIKI_ID/-/test-page")
if echo "$RESULT" | grep -q "edited by joined user"; then
    pass "Edit synced to owner"
else
    fail "Edit synced to owner" "$RESULT"
fi

# ============================================================================
# TEST: Joined user can add tags
# ============================================================================

echo ""
echo "--- Joined User Tag Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"tag":"joined-user-tag"}' "/wikis/$WIKI_ID2/-/joined-page/tag/add")
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Add tag after joining"
else
    fail "Add tag after joining" "$RESULT"
fi

sleep 2

# Verify tag synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/wikis/$WIKI_ID/-/tags")
if echo "$RESULT" | grep -q '"joined-user-tag"'; then
    pass "Tag synced to owner"
else
    fail "Tag synced to owner" "$RESULT"
fi

# ============================================================================
# TEST: Joined user can delete their page
# ============================================================================

echo ""
echo "--- Joined User Delete Page Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST "/wikis/$WIKI_ID2/-/joined-page/delete")
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Delete page after joining"
else
    fail "Delete page after joining" "$RESULT"
fi

sleep 2

# Verify delete synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/wikis/$WIKI_ID/-/joined-page")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Delete synced to owner"
else
    fail "Delete synced to owner" "$RESULT"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=============================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=============================================="
echo ""
echo "Wiki Access Model:"
echo "  - Wikis require joining to interact"
echo "  - Joining creates a local replica"
echo "  - All changes sync between owner and subscribers"
echo "  - Unlike forums/feeds, no direct public access to edit"
echo ""

if [ $FAILED -gt 0 ]; then
    exit 1
fi
