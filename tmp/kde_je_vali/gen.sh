#!/bin/bash
# $1 = výstup, $2 = zadání
CODEX=$(ls ~/.vscode-oss/extensions/openai.chatgpt-*/bin/linux-x86_64/codex | tail -1)
timeout 500 $CODEX exec --skip-git-repo-check -s workspace-write "$2 Ulož ho jako $1 do aktuální složky." < /dev/null > "log_$1.txt" 2>&1
echo "$1 hotovo: $?"
