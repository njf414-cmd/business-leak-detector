#!/usr/bin/env bash

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"

PASS=0
FAIL=0

pass() {
  echo "✅ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "❌ $1"
  FAIL=$((FAIL + 1))
}

echo
echo "======================================"
echo " BUSINESS LEAK DETECTOR VERIFICATION"
echo "======================================"
echo

# -------------------------------------
# CHECK SERVER
# -------------------------------------

if ! curl -s "$BASE_URL" >/dev/null 2>&1; then
  echo "❌ Dev server is not responding at $BASE_URL"
  echo
  echo "Start it in another terminal with:"
  echo "npm run dev"
  exit 1
fi

pass "Dev server reachable"

# -------------------------------------
# TYPESCRIPT
# -------------------------------------

echo
echo "--- TypeScript ---"

if npx tsc --noEmit >/tmp/leak-tsc.log 2>&1; then
  pass "TypeScript"
else
  fail "TypeScript"
  cat /tmp/leak-tsc.log
fi

# -------------------------------------
# DATA QUALITY TORTURE# -------------------------------------

echo
echo "--- Data Quality ---"

curl -s \
  "$BASE_URL/api/test-data-quality" \
  > /tmp/leak-data-quality.json

node <<'NODE'
const fs = require("fs");

try {
  const r = JSON.parse(
    fs.readFileSync(
      "/tmp/leak-data-quality.json",
      "utf8"
    )
  );

  if (!r.success) {
    process.exit(1);
  }
} catch {
  process.exit(1);
}
NODE

if [ $? -eq 0 ]; then
  pass "Data quality torture test"
else
  fail "Data quality torture test"
  cat /tmp/leak-data-quality.json
fi

# -------------------------------------
# DEEP DETECTOR REGRESSION
# -------------------------------------

echo
echo "--- Detector Regression ---"

curl -s \
  "$BASE_URL/api/test-detector-batch?file=deep-leak-master-expansion.json" \
  > /tmp/leak-detector-batch.json

node <<'NODE'
const fs = require("fs");

try {
  const r = JSON.parse(
    fs.readFileSync(
      "/tmp/leak-detector-batch.json",
      "utf8"
    )
  );

  if (!r.success) {
    process.exit(1);
  }
} catch {
  process.exit(1);
}
NODE

if [ $? -eq 0 ]; then
  pass "Deep detector batch #196-315"
else
  fail "Deep detector batch #196-315"
  cat /tmp/leak-detector-batch.json
fi

# =====================================
# TEST CSV FILES
# =====================================

cat > /tmp/verify-auto.csv <<'CSV'
Customer Name,Vehicle,VIN,Invoice Amount,Amount Paid,Invoice Date
John Smith,2022 Honda Civic,1HGCM82633A123456,1200,500,2026-08-01
CSV

cat > /tmp/verify-bad.csv <<'CSV'
Client Name,Invoice Total,Date Invoiced,Paid Amount
Bad Corp,banana,not-a-date,1000
CSV

cat > /tmp/verify-generic.csv <<'CSV'
Customer Name,Invoice Amount,Amount Paid,Invoice Date
Test Customer,1000,1000,2026-08-01
CSV

# =====================================
# AUTOMOTIVE
# =====================================

echo
echo "--- Automotive ---"

curl -s \
  -X POST \
  -F "file=@/tmp/verify-auto.csv" \
  -F "businessName=Smith Auto Repair" \
  -F "description=Automotive repair mechanic vehicle maintenance shop" \
  "$BASE_URL/api/analyze-csv" \
  > /tmp/verify-auto.json

node <<'NODE'
const fs = require("fs");

try {
  const r = JSON.parse(
    fs.readFileSync(
      "/tmp/verify-auto.json",
      "utf8"
    )
  );

  const ok =
    r.success === true &&
    r.classification?.detectedIndustry === "automotive" &&
    r.classification?.effectiveIndustry === "automotive" &&
    r.file?.rowsAccepted === 1 &&
    r.file?.rowsBlocked === 0 &&
    r.analysis?.performed === true &&
    r.analysis?.stats?.detectorsRan > 0 &&
    r.analysis?.leakCount >= 1 &&
    r.analysis?.totalEstimatedLoss === 700;

  if (!ok) {
    process.exit(1);
  }
} catch {
  process.exit(1);
}
NODE

if [ $? -eq 0 ]; then
  pass "Automotive classification + \$700 leak"
else
  fail "Automotive classification + leak detection"
  cat /tmp/verify-auto.json
fi

# =====================================
# BAD DATA BLOCKING
# =====================================

echo
echo "--- Bad Data Blocking ---"

curl -s \
  -X POST \
  -F "file=@/tmp/verify-bad.csv" \
  -F "businessName=Bad Corp" \
  "$BASE_URL/api/analyze-csv" \
  > /tmp/verify-bad.json

node <<'NODE'
const fs = require("fs");

try {
  const r = JSON.parse(
    fs.readFileSync(
      "/tmp/verify-bad.json",
      "utf8"
    )
  );

  const types =
    new Set(
      (r.dataQuality?.issues ?? [])
        .map(x => x.type)
    );

  const ok =
    r.success === true &&
    r.file?.rowsAccepted === 0 &&
    r.file?.rowsBlocked === 1 &&
    r.analysis?.performed === false &&
    r.analysis?.stats?.detectorsSelected === 0 &&
    r.analysis?.stats?.detectorsRan === 0 &&
    r.analysis?.leakCount === 0 &&
    types.has("invalid-money") &&
    types.has("invalid-date");

  if (!ok) {
    process.exit(1);
  }
} catch {
  process.exit(1);
}
NODE

if [ $? -eq 0 ]; then
  pass "Invalid rows blocked before detectors"
else
  fail "Invalid row blocking"
  cat /tmp/verify-bad.json
fi

# =====================================
# INDUSTRY CLASSIFICATION FUNCTION
# =====================================

test_industry() {
  LABEL="$1"
  INDUSTRY="$2"
  BUSINESS="$3"
  DESCRIPTION="$4"

  SAFE=$(echo "$INDUSTRY" | tr '-' '_')

  curl -s \
    -X POST \
    -F "file=@/tmp/verify-generic.csv" \
    -F "businessName=$BUSINESS" \
    -F "description=$DESCRIPTION" \
    "$BASE_URL/api/analyze-csv" \
    > "/tmp/verify-$SAFE.json"

  INDUSTRY_EXPECTED="$INDUSTRY" \
  FILE_PATH="/tmp/verify-$SAFE.json" \
  node <<'NODE'
const fs = require("fs");

try {
  const r = JSON.parse(
    fs.readFileSync(
      process.env.FILE_PATH,
      "utf8"
    )
  );

  const expected =
    process.env.INDUSTRY_EXPECTED;

  const ok =
    r.success === true &&
    r.classification?.detectedIndustry === expected &&
    r.classification?.effectiveIndustry === expected &&
    r.classification?.selectionMode === "automatic" &&
    r.analysis?.performed === true &&
    r.analysis?.stats?.detectorsFailed === 0;

  if (!ok) {
    process.exit(1);
  }
} catch {
  process.exit(1);
}
NODE

  if [ $? -eq 0 ]; then
    pass "$LABEL industry classification"
  else
    fail "$LABEL industry classification"
    cat "/tmp/verify-$SAFE.json"
  fi
}

echo
echo "--- Industry Classification ---"

test_industry \
  "Home Services / HVAC" \
  "home_services" \
  "Premier HVAC Services" \
  "HVAC heating cooling air conditioning plumbing home service company"

test_industry \
  "Construction" \
  "construction" \
  "Premier Construction Group" \
  "General contractor construction remodeling renovation builder"

test_industry \
  "Restaurant" \
  "restaurant" \
  "Main Street Grill" \
  "Restaurant grill cafe food service catering business"

test_industry \
  "Retail" \
  "retail" \
  "Main Street Boutique" \
  "Retail store boutique merchandise shop"

test_industry \
  "Ecommerce" \
  "ecommerce" \
  "Online Commerce Co" \
  "Ecommerce Shopify online store e-commerce business"

# =====================================
# MANUAL INDUSTRY OVERRIDE
# =====================================

echo
echo "--- Manual Override ---"

curl -s \
  -X POST \
  -F "file=@/tmp/verify-generic.csv" \
  -F "businessName=Override Test" \
  -F "description=Automotive mechanic auto repair shop" \
  -F "industry=retail" \
  "$BASE_URL/api/analyze-csv" \
  > /tmp/verify-override.json

node <<'NODE'
const fs = require("fs");

try {
  const r = JSON.parse(
    fs.readFileSync(
      "/tmp/verify-override.json",
      "utf8"
    )
  );

  const ok =
    r.success === true &&
    r.classification?.detectedIndustry === "automotive" &&
    r.classification?.effectiveIndustry === "retail" &&
    r.classification?.selectionMode === "manual";

  if (!ok) {
    process.exit(1);
  }
} catch {
  process.exit(1);
}
NODE

if [ $? -eq 0 ]; then
  pass "Manual industry override"
else
  fail "Manual industry override"
  cat /tmp/verify-override.json
fi

# =====================================
# FINAL
# =====================================

TOTAL=$((PASS + FAIL))

echo
echo "======================================"
echo " RESULTS"
echo "======================================"
echo
echo "Passed: $PASS / $TOTAL"
echo "Failed: $FAIL / $TOTAL"
echo

if [ "$FAIL" -eq 0 ]; then
  echo "🚀 ALL LAUNCH VERIFICATION TESTS PASSED"
  exit 0
else
  echo "⚠️  $FAIL TEST(S) NEED ATTENTION"
  exit 1
fi
