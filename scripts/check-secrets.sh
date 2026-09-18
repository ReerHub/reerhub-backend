#!/usr/bin/env sh
# Local pre-commit secret check (no license, no network, no deps).
# Scans staged additions for common secret shapes and blocks the commit.
# Placeholders (angle brackets, example/change-me/xxx/your-) never match.
# Emergency bypass: git commit --no-verify (then rotate anything pushed).
set -u

TMP_PATTERNS=$(mktemp)
trap 'rm -f "$TMP_PATTERNS"' EXIT INT TERM
cat > "$TMP_PATTERNS" <<'EOF'
-----BEGIN (RSA |EC |OPENSSH |DSA |ED25519 )?PRIVATE KEY-----
mongodb(\+srv)?://[^/[:space:]]*:[^@/:space:][^@[:space:]]*@
(xox[bap]-|ghp_|gho_|AKIA|AIza|re_|sk-live-|sk-test-)[A-Za-z0-9_/-]{16,}
(api[_-]?key|secret|passwd|password|mongo_uri|redis_url|smtp_pass|private_key)[[:space:]]*[:=][[:space:]]*['"]?[^'"[:space:]]{12,}
EOF

fail=0
files=$(git diff --cached --name-only --diff-filter=ACM)
for f in $files; do
  # Skip lockfiles and binary-ish assets — noise, not reviewable secrets.
  case "$f" in
    package-lock.json|*.png|*.jpg|*.jpeg|*.svg|*.ico|*.woff2) continue ;;
  esac
  added=$(git diff --cached -U0 -- "$f" | grep '^+' | grep -v '^+++' || true)
  [ -z "$added" ] && continue
  suspicious=$(printf '%s\n' "$added" | grep -vEi '(<|>|example|changeme|change-me|xxx|your-|placeholder|TODO|FIXME)' || true)
  [ -z "$suspicious" ] && continue
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    hits=$(printf '%s\n' "$suspicious" | grep -Eci -e "$pattern" || true)
    if [ "$hits" -gt 0 ]; then
      short=$(printf '%s' "$pattern" | cut -c1-40)
      echo "[blocked] possible secret in staged file: ${f} (${hits} line(s) like '${short}...')"
      fail=1
    fi
  done < "$TMP_PATTERNS"
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Commit blocked: staged changes look like real secrets."
  echo "If this is a placeholder, add an allowlisted marker (example, change-me, <...>)."
  echo "If you already pushed a real secret: rotate it immediately, then clean history."
  exit 1
fi
exit 0
