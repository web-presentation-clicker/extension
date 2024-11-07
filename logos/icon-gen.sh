#!/bin/bash -e

for f in $@; do
	name="`echo "$f" | head -c-5`"
	mkdir "$name"
	echo "generating icons for $name"
	inkscape -w 16 -h 16 "$f" -o "$name"/"icon16.png"
	inkscape -w 32 -h 32 "$f" -o "$name"/"icon32.png"
	inkscape -w 48 -h 48 "$f" -o "$name"/"icon48.png"
	inkscape -w 128 -h 128 "$f" -o "$name"/"icon128.png"
done

