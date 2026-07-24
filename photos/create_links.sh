#!/usr/bin/env bash
# Usage: ./link-photos.sh /path/to/real/photos
# Symlinks all jpg/jpeg/png files from SRC into ./originals

set -e

SRC="$1"
DEST="originals"

if [ -z "$SRC" ]; then
  echo "Usage: $0 /path/to/real/photos"
  exit 1
fi

mkdir -p "$DEST"

count=0
for f in "$SRC"/*.{jpg,jpeg,png,JPG,JPEG,PNG}; do
  [ -e "$f" ] || continue
  ln -sf "$(realpath "$f")" "$DEST/$(basename "$f")"
  count=$((count + 1))
done

echo "Linked $count file(s) into $DEST/"