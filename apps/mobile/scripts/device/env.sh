# shellcheck shell=bash

moni_path_prepend() {
  local dir=$1
  [[ -d $dir ]] || return 0
  PATH=":$PATH:"
  while [[ $PATH == *":$dir:"* ]]; do PATH=${PATH//":$dir:"/:}; done
  PATH=${PATH#:}
  PATH="$dir:${PATH%:}"
}

export NVM_DIR=${NVM_DIR:-$HOME/.nvm}
moni_node_bin=$(compgen -G "$NVM_DIR/versions/node/v22.*/bin" | sort -V | tail -n 1 || true)
if [[ -n $moni_node_bin ]]; then
  moni_path_prepend "$moni_node_bin"
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  [[ -x $moni_node_bin/pnpm ]] || corepack enable || echo "env.sh: corepack enable failed, pnpm may resolve outside WSL" >&2
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

moni_is_exported() { [[ $(declare -p "$1" 2>/dev/null) == "declare -x"* ]]; }
moni_saved_serial() {
  local saved
  saved=$(cat "$MONI_DEVICE_STATE_DIR/serial" 2>/dev/null || true)
  echo "${saved:-100.127.128.74:5555}"
}
moni_is_exported MONI_DEVICE_SERIAL && [[ -n $MONI_DEVICE_SERIAL ]] || MONI_DEVICE_SERIAL=$(moni_saved_serial)
MONI_DEVICE_HOST=${MONI_DEVICE_SERIAL%:*}
