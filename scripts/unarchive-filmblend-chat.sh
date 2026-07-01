#!/bin/bash
# Unarchive the main Filmblend chat in Cursor.
# IMPORTANT: Quit Cursor completely (Cmd+Q) before running this script.

set -euo pipefail

DB="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
MAIN_CHAT="f402e88c-a1fa-4dc8-bd69-fe7c6a03c95e"
PROJECT_ID="b0bbdcd4-3574-4f6c-b95e-f74ad0306fd6"

if pgrep -x "Cursor" >/dev/null 2>&1; then
  echo "ERROR: Cursor is still running. Quit Cursor completely (Cmd+Q) first, then run this again."
  exit 1
fi

if [[ ! -f "$DB" ]]; then
  echo "ERROR: Cursor state database not found at: $DB"
  exit 1
fi

BACKUP="${DB}.backup-$(date +%Y%m%d-%H%M%S)"
cp "$DB" "$BACKUP"
echo "Backup saved: $BACKUP"

python3 << PY
import sqlite3, json, time

db = "$DB"
main = "$MAIN_CHAT"
project = "$PROJECT_ID"

conn = sqlite3.connect(db)
cur = conn.cursor()

cur.execute("SELECT value FROM ItemTable WHERE key = 'composer.composerHeaders'")
headers = json.loads(cur.fetchone()[0])

for c in headers.get("allComposers", []):
    if c.get("composerId") == main:
        c["isArchived"] = False
        c["hasBeenInSidebar"] = True
        c["lastUpdatedAt"] = int(time.time() * 1000)
        print(f"Unarchived: {c.get('name')}")

cur.execute("UPDATE ItemTable SET value = ? WHERE key = 'composer.composerHeaders'",
            (json.dumps(headers),))

cur.execute("SELECT value FROM ItemTable WHERE key = 'glass.localAgentProjectMembership.v1'")
membership = json.loads(cur.fetchone()[0])
membership[main] = project
cur.execute("UPDATE ItemTable SET value = ? WHERE key = 'glass.localAgentProjectMembership.v1'",
            (json.dumps(membership),))

cur.execute("SELECT value FROM ItemTable WHERE key = 'glass.localAgentProjects.v1'")
projects = json.loads(cur.fetchone()[0])
for p in projects:
    if p.get("id") == project:
        p["isArchived"] = False
cur.execute("UPDATE ItemTable SET value = ? WHERE key = 'glass.localAgentProjects.v1'",
            (json.dumps(projects),))

conn.commit()
conn.close()
print("Done. Reopen Cursor and look under the filmblend folder.")
PY
