#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 REPOSITORY_URL [APP_DIRECTORY]" >&2
  exit 2
fi

repo_url=$1
app_dir=${2:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/pi-zero-rampart-quiz"
log_file="$state_dir/update-check.log"
last_file="$state_dir/last-remote-commit"

command -v git >/dev/null || { echo "ERROR: git is required." >&2; exit 1; }
mkdir -p "$state_dir"
log() { printf '[%s] %s\n' "$(date '+%F %T %Z')" "$*" | tee -a "$log_file"; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

log "Checking $repo_url"
if ! git clone --quiet --depth 1 "$repo_url" "$tmp/repository"; then
  log "ERROR: clone failed; check URL, network, and repository access."
  exit 1
fi

remote=$(git -C "$tmp/repository" rev-parse HEAD)
if git -C "$app_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  local_commit=$(git -C "$app_dir" rev-parse HEAD)
  log "Remote commit: $remote"
  log "Installed Git checkout: $local_commit"
  if [[ "$remote" == "$local_commit" ]]; then
    log "RESULT: checkout matches remote HEAD."
  else
    log "UPDATE AVAILABLE: remote HEAD differs. No files were changed."
  fi
elif [[ -f "$last_file" ]]; then
  previous=$(<"$last_file")
  if [[ "$remote" == "$previous" ]]; then
    log "RESULT: no new remote commit since the last check. Installed ZIP files cannot be compared exactly."
  else
    log "UPSTREAM CHANGED: remote commit changed since last check. Installed ZIP files cannot be compared exactly."
  fi
else
  log "BASELINE: remote HEAD is $remote. Installed non-Git files cannot be compared to it."
fi
printf '%s\n' "$remote" > "$last_file"
log "Check complete."
