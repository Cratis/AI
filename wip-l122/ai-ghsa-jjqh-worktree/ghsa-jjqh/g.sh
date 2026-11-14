#!/bin/bash
# usage: g.sh script cmd...   prints exit + stderr first line
s=$1; shift
for c in "$@"; do
  j=$(node -e 'console.log(JSON.stringify({tool_name:"Bash",tool_input:{command:process.argv[1]}}))' -- "$c")
  out=$(printf '%s' "$j" | CRATIS_HOOKS_ALLOW_SECRET_READS=0 CRATIS_HOOKS_ALLOW_STORE_MUTATIONS=0 ${SHELL_UNDER:-bash} .cratis/ai/hooks/scripts/$s 2>&1); rc=$?
  printf '%s\t%s\t%s\n' "$rc" "$c" "$(printf '%s' "$out" | head -1 | cut -c1-110)"
done
