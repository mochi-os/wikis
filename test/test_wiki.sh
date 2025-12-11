#!/bin/bash
# Wiki app test suite
# Usage: ./test_wiki.sh

set -e

SCRIPT_DIR="$(dirname "$0")"
CURL_HELPER="/home/alistair/mochi/test/claude/curl.sh"

PASSED=0
FAILED=0
WIKI_ENTITY=""

pass() {
    echo "[PASS] $1"
    ((PASSED++)) || true
}

fail() {
    echo "[FAIL] $1: $2"
    ((FAILED++))
}

# Helper to make wiki requests
# Entity context uses /-/ prefix for wiki-level routes
wiki_curl() {
    local method="$1"
    local path="$2"
    shift 2
    "$CURL_HELPER" -a admin -X "$method" "$@" "$BASE_URL$path"
}

# Helper for wiki-level routes that need /-/ prefix in entity context
wiki_api_curl() {
    local method="$1"
    local path="$2"
    shift 2
    "$CURL_HELPER" -a admin -X "$method" "$@" "$BASE_URL/-$path"
}

echo "=============================================="
echo "Wiki Test Suite"
echo "=============================================="

# ============================================================================
# WIKI CREATION TEST
# ============================================================================

echo ""
echo "--- Wiki Creation Test ---"

# Test: Create wiki
RESULT=$("$CURL_HELPER" -a admin -X POST -H "Content-Type: application/json" -d '{"name":"Test Wiki"}' "/wiki/create")
if echo "$RESULT" | grep -q '"id":"'; then
    WIKI_ENTITY=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
    if [ -n "$WIKI_ENTITY" ]; then
        pass "Create wiki (entity: $WIKI_ENTITY)"
        BASE_URL="/$WIKI_ENTITY"
    else
        fail "Create wiki" "Could not extract entity ID"
        exit 1
    fi
else
    fail "Create wiki" "$RESULT"
    exit 1
fi

echo "Using wiki entity: $WIKI_ENTITY"

# ============================================================================
# PAGE LIFECYCLE TESTS
# ============================================================================

echo ""
echo "--- Page Lifecycle Tests ---"

# Test: Create page (uses /-/new route in entity context)
RESULT=$(wiki_api_curl POST "/new" -H "Content-Type: application/json" -d '{"slug":"test-create","title":"Test Create","content":"Test content"}')
if echo "$RESULT" | grep -q '"slug":"test-create"'; then
    pass "Create page"
else
    fail "Create page" "$RESULT"
fi

# Test: Get page
RESULT=$(wiki_curl GET "/test-create")
if echo "$RESULT" | grep -q '"title":"Test Create"'; then
    pass "Get page"
else
    fail "Get page" "$RESULT"
fi

# Test: Edit page
RESULT=$(wiki_curl POST "/test-create/edit" -H "Content-Type: application/json" -d '{"title":"Updated Title","content":"Updated content","comment":"Test edit"}')
if echo "$RESULT" | grep -q '"version":2'; then
    pass "Edit page"
else
    fail "Edit page" "$RESULT"
fi

# Test: Page not found
RESULT=$(wiki_curl GET "/nonexistent-page-xyz")
if echo "$RESULT" | grep -q '"error":"not_found"'; then
    pass "Page not found"
else
    fail "Page not found" "$RESULT"
fi

# Test: Delete page
RESULT=$(wiki_curl POST "/test-create/delete")
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Delete page"
else
    fail "Delete page" "$RESULT"
fi

# ============================================================================
# REVISION HISTORY TESTS
# ============================================================================

echo ""
echo "--- Revision History Tests ---"

# Create page with multiple edits
wiki_api_curl POST "/new" -H "Content-Type: application/json" -d '{"slug":"test-history","title":"Version 1","content":"Content v1"}' > /dev/null
wiki_curl POST "/test-history/edit" -H "Content-Type: application/json" -d '{"title":"Version 2","content":"Content v2","comment":"Edit 1"}' > /dev/null
wiki_curl POST "/test-history/edit" -H "Content-Type: application/json" -d '{"title":"Version 3","content":"Content v3","comment":"Edit 2"}' > /dev/null

# Test: Get history
RESULT=$(wiki_curl GET "/test-history/history")
if echo "$RESULT" | grep -q '"revisions":\['; then
    pass "Get history"
else
    fail "Get history" "$RESULT"
fi

# Test: Get specific revision
RESULT=$(wiki_curl GET "/test-history/history/1")
if echo "$RESULT" | grep -q '"version":1'; then
    pass "Get revision"
else
    fail "Get revision" "$RESULT"
fi

# Test: Revert to previous version
RESULT=$(wiki_curl POST "/test-history/revert" -H "Content-Type: application/json" -d '{"version":1,"comment":"Reverting"}')
if echo "$RESULT" | grep -q '"reverted_from":1'; then
    pass "Revert page"
else
    fail "Revert page" "$RESULT"
fi

# Clean up
wiki_curl POST "/test-history/delete" > /dev/null

# ============================================================================
# TAG TESTS
# ============================================================================

echo ""
echo "--- Tag Tests ---"

# Create test page
wiki_api_curl POST "/new" -H "Content-Type: application/json" -d '{"slug":"test-tags","title":"Tag Test","content":"Content"}' > /dev/null

# Test: Add tag
RESULT=$(wiki_curl POST "/test-tags/tag/add" -H "Content-Type: application/json" -d '{"tag":"test-tag"}')
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Add tag"
else
    fail "Add tag" "$RESULT"
fi

# Test: List tags
RESULT=$(wiki_api_curl GET "/tags")
if echo "$RESULT" | grep -q '"tags":\['; then
    pass "List tags"
else
    fail "List tags" "$RESULT"
fi

# Test: Get pages by tag
RESULT=$(wiki_api_curl GET "/tag/test-tag")
if echo "$RESULT" | grep -q '"pages":\['; then
    pass "Get pages by tag"
else
    fail "Get pages by tag" "$RESULT"
fi

# Test: Remove tag
RESULT=$(wiki_curl POST "/test-tags/tag/remove" -H "Content-Type: application/json" -d '{"tag":"test-tag"}')
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Remove tag"
else
    fail "Remove tag" "$RESULT"
fi

# Clean up
wiki_curl POST "/test-tags/delete" > /dev/null

# ============================================================================
# REDIRECT TESTS
# ============================================================================

echo ""
echo "--- Redirect Tests ---"

# Create target page
wiki_api_curl POST "/new" -H "Content-Type: application/json" -d '{"slug":"redirect-target","title":"Target","content":"Content"}' > /dev/null

# Test: Set redirect
RESULT=$(wiki_api_curl POST "/redirect/set" -H "Content-Type: application/json" -d '{"source":"old-url","target":"redirect-target"}')
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Set redirect"
else
    fail "Set redirect" "$RESULT"
fi

# Test: List redirects
RESULT=$(wiki_api_curl GET "/redirects")
if echo "$RESULT" | grep -q '"redirects":\['; then
    pass "List redirects"
else
    fail "List redirects" "$RESULT"
fi

# Test: Delete redirect
RESULT=$(wiki_api_curl POST "/redirect/delete" -H "Content-Type: application/json" -d '{"source":"old-url"}')
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Delete redirect"
else
    fail "Delete redirect" "$RESULT"
fi

# Clean up
wiki_curl POST "/redirect-target/delete" > /dev/null

# ============================================================================
# SEARCH TESTS
# ============================================================================

echo ""
echo "--- Search Tests ---"

# Create test pages
wiki_api_curl POST "/new" -H "Content-Type: application/json" -d '{"slug":"search-test-1","title":"Unique Searchable Title","content":"Some content"}' > /dev/null
wiki_api_curl POST "/new" -H "Content-Type: application/json" -d '{"slug":"search-test-2","title":"Another Page","content":"Contains xyz789unique text"}' > /dev/null

# Test: Search by title
RESULT=$(wiki_api_curl GET "/search?q=Unique%20Searchable")
if echo "$RESULT" | grep -q '"results":\['; then
    pass "Search by title"
else
    fail "Search by title" "$RESULT"
fi

# Test: Search by content
RESULT=$(wiki_api_curl GET "/search?q=xyz789unique")
if echo "$RESULT" | grep -q 'search-test-2'; then
    pass "Search by content"
else
    fail "Search by content" "$RESULT"
fi

# Test: Empty search
RESULT=$(wiki_api_curl GET "/search?q=nonexistent-query-abc123")
if echo "$RESULT" | grep -q '"results":\[\]'; then
    pass "Empty search results"
else
    fail "Empty search results" "$RESULT"
fi

# Clean up
wiki_curl POST "/search-test-1/delete" > /dev/null
wiki_curl POST "/search-test-2/delete" > /dev/null

# ============================================================================
# SETTINGS TESTS
# ============================================================================

echo ""
echo "--- Settings Tests ---"

# Test: Get settings
RESULT=$(wiki_api_curl GET "/settings")
if echo "$RESULT" | grep -q '"settings":'; then
    pass "Get settings"
else
    fail "Get settings" "$RESULT"
fi

# Test: Set setting
RESULT=$(wiki_api_curl POST "/settings/set" -H "Content-Type: application/json" -d '{"name":"home","value":"custom-home"}')
if echo "$RESULT" | grep -q '"ok":true'; then
    pass "Set setting"
else
    fail "Set setting" "$RESULT"
fi

# Reset to default
wiki_api_curl POST "/settings/set" -H "Content-Type: application/json" -d '{"name":"home","value":"home"}' > /dev/null

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
