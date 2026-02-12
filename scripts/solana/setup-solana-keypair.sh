#!/usr/bin/env bash
set -euo pipefail

# Writes a Solana keypair JSON (64-byte array) into ~/.config/solana/id.json.
#
# Preferred env vars (CI):
# - AGENTWALLET_SOLANA_KEYPAIR_JSON: JSON array string (e.g. "[1,2,...]")
# - AGENTWALLET_SOLANA_KEYPAIR: same as above
#
# Legacy fallback:
# - SOLANA_KEYPAIR: JSON array string

KEYPAIR_JSON="${AGENTWALLET_SOLANA_KEYPAIR_JSON:-${AGENTWALLET_SOLANA_KEYPAIR:-${SOLANA_KEYPAIR:-}}}"

if [[ -z "${KEYPAIR_JSON}" ]]; then
  echo "No keypair JSON found in env (AGENTWALLET_SOLANA_KEYPAIR_JSON/AGENTWALLET_SOLANA_KEYPAIR/SOLANA_KEYPAIR)." >&2
  echo "Skipping keypair setup." >&2
  exit 3
fi

mkdir -p "${HOME}/.config/solana"

# Support either a raw JSON array, or a quoted JSON string.
if echo "${KEYPAIR_JSON}" | jq -e . >/dev/null 2>&1; then
  echo "${KEYPAIR_JSON}" > "${HOME}/.config/solana/id.json"
else
  echo "${KEYPAIR_JSON}" | jq -r . > "${HOME}/.config/solana/id.json"
fi

chmod 600 "${HOME}/.config/solana/id.json"

# Validate basic structure (64 integers).
LEN=$(jq 'length' "${HOME}/.config/solana/id.json")
if [[ "${LEN}" -ne 64 ]]; then
  echo "Invalid keypair length: expected 64, got ${LEN}" >&2
  exit 4
fi

echo "Wrote Solana keypair to ${HOME}/.config/solana/id.json"