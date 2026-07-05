#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_DIR="${TASKMAN_TASKS_DIR:-$SCRIPT_DIR/tasks}"

# --- helpers -------------------------------------------------------

valid_id() {
  case "$1" in
  [0-9][0-9][0-9]) return 0 ;;
  *) return 1 ;;
  esac
}

fm_close() {
  head -n 1 "$1" | grep -q '^---$' || {
    echo 0
    return 1
  }
  line=$(grep -n '^---$' "$1" | sed -n '2p' | cut -d: -f1)
  [ -n "$line" ] || {
    echo 0
    return 1
  }
  echo "$line"
}

range() {
  awk "NR >= $1 && NR <= $2" "$3" 2>/dev/null
}

find_task_by_id() {
  id="$1"
  shift
  find "$TASKS_DIR" -maxdepth 2 -name "$id-*.md" "$@" 2>/dev/null | head -1
}

inject_completed_at() {
  file="$1"
  fm_line=$(fm_close "$file") || return 1
  range 1 "$fm_line" "$file" | grep -q "^completed_at:" && return 0
  awk -v fm_line="$fm_line" -v date="$(date +%F)" '
    NR == fm_line { print "completed_at: " date; print "---"; next }
    { print }
  ' "$file" >"$file.tmp" && mv "$file.tmp" "$file"
}

parse_task_header() {
  file="$1"
  id=$(basename "$file" | sed 's/^\([0-9]\{3\}\)-.*/\1/')
  desc=$(sed -n 's/^description: *//p' "$file" | head -1 | sed 's/^"//; s/"$//; s/\\\\/\\/g; s/\\"/"/g')
  echo "$id	$desc"
}

emit_task_info() {
  file="$1"
  id=$(basename "$file" | sed 's/^\([0-9]\{3\}\)-.*/\1/')
  awk -F': ' -v id="$id" '
    /^---$/ { if (c++) exit }
    /^description:/ { desc=$0; sub(/^description: *"?/, "", desc); sub(/"?$/, "", desc); gsub(/\\\\/, "\\", desc); gsub(/\\"/, "\"", desc) }
    /^important: true/ { score += 2 }
    /^urgent: true/ { score += 1 }
    END { print id "\t" score+0 "\t" desc }
  ' "$file"
}

valid_dir() {
  case "$1" in
  pending | in_progress | done | canceled) return 0 ;;
  *) return 1 ;;
  esac
}

# --- commands ------------------------------------------------------

# create <desc> [--important] [--urgent] [--depends 001,002]
#   stdout: id<tab>filepath
create() {
  desc="$1"
  shift

  # Reject empty, whitespace-only, or multi-line descriptions
  [ -z "$(printf '%s' "$desc" | tr -d ' \t')" ] && {
    echo "Error: description required (non-whitespace)" >&2
    return 1
  }
  case "$desc" in
  *'
'*)
    echo "Error: description must be single line" >&2
    return 1
    ;;
  esac

  important="false"
  urgent="false"
  depends=""
  while [ $# -gt 0 ]; do
    case "$1" in
    --important) important="true" ;;
    --urgent) urgent="true" ;;
    --depends)
      [ $# -lt 2 ] && {
        echo "Error: --depends requires a value" >&2
        return 1
      }
      case "$2" in
      --*)
        echo "Error: --depends value cannot be an option: $2" >&2
        return 1
        ;;
      esac
      depends="$2"
      shift
      ;;
    *)
      echo "Error: unknown option: $1" >&2
      return 1
      ;;
    esac
    shift
  done

  # Validate dependency IDs
  if [ -n "$depends" ]; then
    echo "$depends" | grep -q '^[0-9][0-9][0-9]\(,[0-9][0-9][0-9]\)*$' || {
      echo "Error: invalid dependency format: $depends (use 001,002,...)" >&2
      return 1
    }
  fi

  max=$(find "$TASKS_DIR" -name '*.md' 2>/dev/null |
    sed -n 's/.*\/\([0-9]\{3\}\)-.*/\1/p' |
    sort -rn | head -1)
  max=$(echo "${max:-0}" | sed 's/^0*//')
  [ -z "$max" ] && max=0
  next=$((max + 1))
  id=$(printf "%03d" "$next")
  slug=$(echo "$desc" |
    tr '[:upper:]' '[:lower:]' |
    sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//')
  [ -z "$slug" ] && slug="task"
  filename="$id-$slug.md"
  filepath="$TASKS_DIR/pending/$filename"

  # YAML-safe description: double-quote with escaping
  desc_escaped=$(printf '%s' "$desc" | sed 's/\\/\\\\/g; s/"/\\"/g')

  mkdir -p "$TASKS_DIR/pending"
  {
    echo "---"
    echo "description: \"$desc_escaped\""
    echo "created_at: $(date +%F)"
    echo "important: $important"
    echo "urgent: $urgent"
    if [ -n "$depends" ]; then
      echo "depends_on:"
      echo "$depends" | tr ',' '\n' | sed 's/^/  - /'
    fi
    echo "---"
    echo ""
    echo "# 📍 Next Action"
    echo ""
    echo "# 📝 Worklog"
  } >"$filepath"

  printf "%s\t%s\n" "$id" "$filepath"
}

# move <id> <target>
#   stdout: oldpath<tab>newpath
move() {
  id="$1"
  target="$2"
  [ -z "$id" ] && {
    echo "Error: missing id" >&2
    return 1
  }
  valid_id "$id" || {
    echo "Error: invalid task ID: $id" >&2
    return 1
  }
  [ -z "$target" ] && {
    echo "Error: missing target" >&2
    return 1
  }
  valid_dir "$target" || {
    echo "Error: invalid target: $target (pending|in_progress|done|canceled)" >&2
    return 1
  }

  file=$(find_task_by_id "$id" ! -path "*/$target/*")
  [ -z "$file" ] && {
    echo "Error: task $id not found or already in $target" >&2
    return 1
  }

  mkdir -p "$TASKS_DIR/$target"
  if [ "$target" = "done" ]; then
    inject_completed_at "$file" || {
      echo "Error: failed to update completed_at for $id" >&2
      return 1
    }
  fi

  target_path="$TASKS_DIR/$target/$(basename "$file")"
  [ -e "$target_path" ] && {
    echo "Error: target file already exists: $target_path" >&2
    return 1
  }
  mv "$file" "$target_path"
  printf "%s\t%s\n" "$file" "$target_path"
}

# next
#   stdout: TSV lines (id\tscore\tdescription), tsort-ordered then orphans by score
next() {
  pairs=$(mktemp)
  trap 'rm -f "$pairs"' EXIT HUP INT TERM

  for f in "$TASKS_DIR"/pending/*.md; do
    [ -f "$f" ] || continue
    id=$(basename "$f" | sed 's/^\([0-9]\{3\}\)-.*/\1/')
    close=$(fm_close "$f") || {
      echo "Error: malformed frontmatter in '$f'" >&2
      return 1
    }
    range 1 "$close" "$f" | awk '/^depends_on:/ {flag=1; next} /^---$/ {flag=0} flag && /^[[:space:]]*- / {
      gsub(/^[[:space:]]*-[[:space:]]*/, "", $0);
      print $0, id
    }' id="$id"
  done >"$pairs"

  sorted=""
  if [ -s "$pairs" ]; then
    sorted=$(tsort "$pairs" 2>/dev/null) || {
      echo "Error: circular dependency detected in pending tasks" >&2
      rm -f "$pairs"
      return 1
    }
  fi
  rm -f "$pairs"

  echo "$sorted" | while read -r id; do
    [ -z "$id" ] && continue
    f=$(find_task_by_id "$id" -path "*/pending/*")
    [ -f "$f" ] || continue
    emit_task_info "$f"
  done

  {
    for f in "$TASKS_DIR"/pending/*.md; do
      [ -f "$f" ] || continue
      id=$(basename "$f" | sed 's/^\([0-9]\{3\}\)-.*/\1/')
      echo "$sorted" | grep -qx "$id" && continue
      emit_task_info "$f"
    done
  } | sort -k2,2rn
}

# progress <id>
#   stdout: "<total> <done>"
progress() {
  id="$1"
  [ -z "$id" ] && {
    echo "Error: missing id" >&2
    return 1
  }
  valid_id "$id" || {
    echo "Error: invalid task ID: $id" >&2
    return 1
  }

  file=$(find_task_by_id "$id")
  [ -z "$file" ] && {
    echo "Error: task $id not found" >&2
    return 1
  }

  yaml_end=$(grep -n '^---$' "$file" 2>/dev/null | tail -1 | cut -d: -f1)
  next_action=$(grep -n '^# 📍 Next Action' "$file" 2>/dev/null | head -1 | cut -d: -f1)

  if [ -n "$yaml_end" ] && [ -n "$next_action" ] && [ "$yaml_end" -lt "$next_action" ]; then
    body=$(sed -n "$((yaml_end + 1)),$((next_action - 1))p" "$file")
  else
    body=$(cat "$file")
  fi

  pending_count=$(echo "$body" | grep -c -- '- \[ \]' 2>/dev/null || true)
  done_count=$(echo "$body" | grep -c -- '- \[x\]' 2>/dev/null || true)
  total=$((pending_count + done_count))
  echo "$total $done_count"
}

# list [dir]
#   stdout: TSV lines (id\tdescription)
list() {
  dir="${1:-pending}"
  valid_dir "$dir" || {
    echo "Error: invalid dir: $dir (pending|in_progress|done|canceled)" >&2
    return 1
  }

  for f in "$TASKS_DIR/$dir"/*.md; do
    [ -f "$f" ] || continue
    parse_task_header "$f"
  done
}

help() {
  echo "Usage: tasks.sh <command> [args]"
  echo ""
  echo "Commands:"
  echo "  create <desc> [--important] [--urgent] [--depends 001,002]"
  echo "  move <id> <target>"
  echo "  next"
  echo "  progress <id>"
  echo "  list [dir]"
}

# --- dispatch ------------------------------------------------------

main() {
  cmd="${1:-help}"
  [ $# -gt 0 ] && shift
  case "$cmd" in
  create | move | next | progress | list) "$cmd" "$@" ;;
  help | --help) help ;;
  *)
    echo "Error: unknown command: $cmd" >&2
    exit 1
    ;;
  esac
}

main "$@"
