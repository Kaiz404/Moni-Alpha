# shellcheck shell=bash
# Source this file from bash: `source apps/mobile/scripts/device/env.sh`.

moni_path_prepend() {
  local dir=$1
  [[ -d $dir ]] || return 0
  PATH=":$PATH:"
  PATH=${PATH//":$dir:"/:}
  PATH=${PATH#:}
  PATH="$dir:${PATH%:}"
}

export NVM_DIR=${NVM_DIR:-$HOME/.nvm}
moni_node_bin=$(compgen -G "$NVM_DIR/versions/node/v22.*/bin" | sort -V | tail -n 1)
if [[ -n $moni_node_bin ]]; then
  moni_path_prepend "$moni_node_bin"
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  [[ -x $moni_node_bin/pnpm ]] || corepack enable
else
  echo "env.sh: no node 22 under $NVM_DIR/versions/node, run: nvm install 22" >&2
fi
unset moni_node_bin

export ANDROID_HOME=${ANDROID_HOME:-$HOME/Android/Sdk}
moni_path_prepend "$HOME/.maestro/bin"
moni_path_prepend "$ANDROID_HOME/platform-tools"
export PATH

export MONI_TAILSCALE=${MONI_TAILSCALE:-$(command -v tailscale.exe || echo "/mnt/c/Program Files/Tailscale/tailscale.exe")}
export MONI_DEVICE_NAME=${MONI_DEVICE_NAME:-redmi-note-13-pro-5g}
export MONI_DEVICE_STATE_DIR=${MONI_DEVICE_STATE_DIR:-$HOME/.local/share/moni-device}
mkdir -p "$MONI_DEVICE_STATE_DIR"

# An exported MONI_DEVICE_SERIAL is an override. Otherwise re-read the serial
# that connect.sh last reached, because Wireless debugging ports rotate.
if [[ $(declare -p MONI_DEVICE_SERIAL 2>/dev/null) != "declare -x"* ]]; then
  MONI_DEVICE_SERIAL=$(cat "$MONI_DEVICE_STATE_DIR/serial" 2>/dev/null || echo 100.127.128.74:5555)
fi
MONI_DEVICE_HOST=${MONI_DEVICE_SERIAL%:*}
