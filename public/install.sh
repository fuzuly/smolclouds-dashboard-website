#!/bin/sh
# Installs the smolclouds CLI. Usage: curl -fsSL https://smolclouds.com/install.sh | sh
set -eu

CLI_URL="https://api.smolclouds.com/cli/smolclouds"
INSTALL_DIR="$HOME/.local/bin"
DEST="$INSTALL_DIR/smolclouds"

if ! command -v python3 >/dev/null 2>&1; then
  echo "smolclouds needs python3, which was not found on PATH." >&2
  echo "Install Python 3 (https://www.python.org/downloads/) and re-run this script." >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$CLI_URL" -o "$DEST"
elif command -v wget >/dev/null 2>&1; then
  wget -q "$CLI_URL" -O "$DEST"
else
  echo "smolclouds needs curl or wget to download the CLI." >&2
  exit 1
fi

if [ ! -s "$DEST" ] || ! head -c 32 "$DEST" | grep -q '^#!'; then
  echo "Download from $CLI_URL looked wrong; aborting install." >&2
  rm -f "$DEST"
  exit 1
fi

chmod +x "$DEST"
echo "Installed smolclouds to $DEST"

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo ""
    echo "$INSTALL_DIR is not on your PATH yet. Add this to your shell profile"
    echo "(~/.bashrc, ~/.zshrc, etc.) and open a new shell:"
    echo ""
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    echo ""
    ;;
esac

echo "Next: smolclouds auth <your sc_live_ token>"
