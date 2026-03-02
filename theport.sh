#!/usr/bin/env bash
set -euo pipefail

# the-port.sh
# Portable setup for:
# - VM public entrypoint (Caddy reverse proxy) -> home server over Tailscale
# - Namecoin .bit points to VM public IP (script prints JSON to paste)
log() { printf '[the-port] %s\n' "$*"; }
log "gladosb5 is the goat yaaa"
die() { printf '[the-port] ERROR: %s\n' "$*" >&2; exit 1; }

need_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    die "Run as root (sudo)."
  fi
}

have() { command -v "$1" >/dev/null 2>&1; }

os_id() {
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    printf '%s\n' "${ID:-unknown}"
  else
    printf 'unknown\n'
  fi
}

install_pkg() {
  # Minimal dependency installer
  local pkgs=("$@")
  if have apt-get; then
    apt-get update -y
    DEBIAN_FRONTEND=noninteractive apt-get install -y "${pkgs[@]}"
  elif have dnf; then
    dnf install -y "${pkgs[@]}"
  elif have yum; then
    yum install -y "${pkgs[@]}"
  elif have pacman; then
    pacman -Sy --noconfirm "${pkgs[@]}"
  elif have apk; then
    apk add --no-cache "${pkgs[@]}"
  elif have zypper; then
    zypper --non-interactive install -y "${pkgs[@]}"
  else
    die "No supported package manager found (apt, dnf, yum, pacman, apk, zypper)."
  fi
}

ensure_basics() {
  if ! have curl; then install_pkg curl; fi
  if ! have ca-certificates; then
    # Some distros provide update-ca-certificates inside ca-certificates
    install_pkg ca-certificates || true
  fi
  if ! have tar; then install_pkg tar; fi
  if ! have gzip; then install_pkg gzip || true; fi
}

ensure_tailscale() {
  if have tailscale && have tailscaled; then
    log "Tailscale already installed."
    return 0
  fi

  ensure_basics
  log "Installing Tailscale via official installer..."
  curl -fsSL "https://tailscale.com/install.sh" | sh
  # Start service (systemd)
  if have systemctl; then
    systemctl enable --now tailscaled || true
  fi
}

tailscale_up() {
  local authkey="${1:-}"
  if [ -n "$authkey" ]; then
    log "Bringing up Tailscale with auth key (non-interactive)."
    # Avoid resetting existing settings; just bring it up if not already.
    tailscale up --authkey="$authkey" || true
  else
    log "No TS auth key provided. Run this interactively if needed: sudo tailscale up"
  fi
}

arch_map_caddy() {
  local m
  m="$(uname -m || true)"
  case "$m" in
    x86_64|amd64) echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    armv7l|armv7) echo "armv7" ;;
    armv6l|armv6) echo "armv6" ;;
    i386|i686) echo "386" ;;
    *) die "Unsupported arch for Caddy static binary: $m" ;;
  esac
}

get_latest_caddy_tag() {
  ensure_basics
  # Prefer python for JSON parsing, fallback to sed/grep
  local api="https://api.github.com/repos/caddyserver/caddy/releases/latest"
  if have python3; then
    curl -fsSL "$api" | python3 - <<'PY'
import sys, json
print(json.load(sys.stdin)["tag_name"])
PY
  else
    curl -fsSL "$api" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1
  fi
}

ensure_libcap() {
  # setcap is in libcap packages; names differ by distro
  if have setcap; then return 0; fi

  local id
  id="$(os_id)"
  case "$id" in
    ubuntu|debian|raspbian|linuxmint) install_pkg libcap2-bin ;;
    alpine) install_pkg libcap ;;
    arch|manjaro) install_pkg libcap ;;
    fedora|rhel|centos|rocky|almalinux) install_pkg libcap ;;
    amzn|amazon) install_pkg libcap ;;
    opensuse*|sles) install_pkg libcap-progs ;;
    *) install_pkg libcap || install_pkg libcap2-bin || true ;;
  esac

  have setcap || log "Warning: setcap not found; Caddy may need to run as root to bind 80/443."
}

install_caddy_static() {
  if have caddy; then
    log "Caddy already installed."
    return 0
  fi

  ensure_basics
  ensure_libcap

  local tag ver arch url tmp
  tag="$(get_latest_caddy_tag)"
  [ -n "$tag" ] || die "Could not detect latest Caddy release tag."
  ver="${tag#v}"
  arch="$(arch_map_caddy)"
  url="https://github.com/caddyserver/caddy/releases/download/${tag}/caddy_${ver}_linux_${arch}.tar.gz"
  tmp="$(mktemp -d)"

  log "Downloading Caddy ${tag} for linux/${arch}..."
  curl -fsSL -o "${tmp}/caddy.tgz" "$url"
  tar -xzf "${tmp}/caddy.tgz" -C "$tmp"
  install -m 0755 "${tmp}/caddy" /usr/local/bin/caddy
  rm -rf "$tmp"

  # Create user and dirs
  if ! id caddy >/dev/null 2>&1; then
    useradd --system --home /var/lib/caddy --shell /usr/sbin/nologin caddy || true
  fi
  mkdir -p /etc/caddy /var/lib/caddy /var/log/caddy
  chown -R caddy:caddy /var/lib/caddy /var/log/caddy || true

  # Allow binding to 80/443 as non-root
  if have setcap; then
    setcap 'cap_net_bind_service=+ep' /usr/local/bin/caddy || true
  fi

  # systemd service
  if have systemctl; then
    cat >/etc/systemd/system/caddy.service <<'UNIT'
[Unit]
Description=Caddy web server
After=network-online.target
Wants=network-online.target

[Service]
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=10
LimitNOFILE=1048576
LimitNPROC=512
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/var/lib/caddy /var/log/caddy /etc/caddy
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload
    systemctl enable caddy || true
  else
    log "No systemd detected. You will need to run caddy manually."
  fi
}

open_firewall_vm() {
  # Best-effort open inbound ports 80/443
  if have ufw; then
    ufw allow 80/tcp || true
    ufw allow 443/tcp || true
    ufw --force enable || true
    return 0
  fi
  if have firewall-cmd; then
    firewall-cmd --permanent --add-service=http || true
    firewall-cmd --permanent --add-service=https || true
    firewall-cmd --reload || true
    return 0
  fi
  if have iptables; then
    iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 80 -j ACCEPT
    iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 443 -j ACCEPT
    log "iptables rules added (may not persist across reboot)."
    return 0
  fi
  log "No firewall tool found to open ports; ensure 80/443 are allowed on the VM."
}

lockdown_home_port() {
  local port="$1"
  local allow_ip="$2"

  [ -n "$port" ] || die "--service-port is required for home lockdown"
  [ -n "$allow_ip" ] || die "--allow-from (VM Tailscale IP) is required for home lockdown"

  if have ufw; then
    ufw allow from "$allow_ip" to any port "$port" proto tcp || true
    ufw deny "$port"/tcp || true
    ufw --force enable || true
    return 0
  fi

  if have firewall-cmd; then
    # firewalld rich rules
    firewall-cmd --permanent --add-rich-rule="rule family=ipv4 source address=${allow_ip} port port=${port} protocol=tcp accept" || true
    firewall-cmd --permanent --add-rich-rule="rule family=ipv4 port port=${port} protocol=tcp drop" || true
    firewall-cmd --reload || true
    return 0
  fi

  if have iptables; then
    iptables -C INPUT -p tcp -s "$allow_ip" --dport "$port" -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp -s "$allow_ip" --dport "$port" -j ACCEPT
    iptables -C INPUT -p tcp --dport "$port" -j DROP 2>/dev/null || iptables -I INPUT -p tcp --dport "$port" -j DROP
    log "iptables lockdown added (may not persist across reboot)."
    return 0
  fi

  log "No firewall tool found to lockdown port. Do it manually."
}

write_caddyfile() {
  local domain="$1"
  local origin="$2"
  local tls_mode="$3"
  local cert="${4:-}"
  local key="${5:-}"

  [ -n "$domain" ] || die "--domain is required"
  [ -n "$origin" ] || die "--origin is required (home_tailscale_ip:port)"

  mkdir -p /etc/caddy

  case "$tls_mode" in
    http)
      cat >/etc/caddy/Caddyfile <<EOF
http://${domain} {
  reverse_proxy ${origin}
}
EOF
      ;;
    internal)
      cat >/etc/caddy/Caddyfile <<EOF
${domain} {
  tls internal
  reverse_proxy ${origin}
}
EOF
      ;;
    manual)
      [ -n "$cert" ] || die "--cert required for --tls manual"
      [ -n "$key" ] || die "--key required for --tls manual"
      cat >/etc/caddy/Caddyfile <<EOF
${domain} {
  tls ${cert} ${key}
  reverse_proxy ${origin}
}
EOF
      ;;
    *)
      die "Unknown TLS mode: $tls_mode (use http, internal, manual)"
      ;;
  esac
}

public_ip() {
  ensure_basics
  # Best effort
  curl -fsSL "https://api.ipify.org" || true
}

print_namecoin_json() {
  local ip="$1"
  [ -n "$ip" ] || ip="$(public_ip)"
  [ -n "$ip" ] || die "Could not detect public IP. Pass it manually."

  cat <<EOF
Paste this as the value for your Namecoin name (d/yourname):

{"ip":"${ip}"}

If your VM IP changes often, consider delegating via ns or alias instead of updating the blockchain each time.
EOF
}

usage() {
  cat <<'EOF'
Usage:

VM setup (public entrypoint + reverse proxy):
  sudo ./the-port.sh vm --domain example.bit --origin 100.64.12.34:8080 [--authkey TSKEY] [--tls http|internal|manual] [--cert /path] [--key /path]

Home setup (tailscale + optional port lockdown to only VM):
  sudo ./the-port.sh home [--authkey TSKEY] [--lockdown --service-port 8080 --allow-from 100.64.56.78]

Print Namecoin JSON for current VM public IP:
  sudo ./the-port.sh namecoin-json [--ip 203.0.113.10]
EOF
}

main() {
  need_root

  local mode="${1:-}"
  shift || true

  local domain="" origin="" authkey="" tls_mode="http" cert="" key=""
  local lockdown="0" service_port="" allow_from="" ip_override=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --domain) domain="${2:-}"; shift 2 ;;
      --origin) origin="${2:-}"; shift 2 ;;
      --authkey) authkey="${2:-}"; shift 2 ;;
      --tls) tls_mode="${2:-}"; shift 2 ;;
      --cert) cert="${2:-}"; shift 2 ;;
      --key) key="${2:-}"; shift 2 ;;
      --lockdown) lockdown="1"; shift ;;
      --service-port) service_port="${2:-}"; shift 2 ;;
      --allow-from) allow_from="${2:-}"; shift 2 ;;
      --ip) ip_override="${2:-}"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) die "Unknown arg: $1" ;;
    esac
  done

  case "$mode" in
    vm)
      ensure_tailscale
      tailscale_up "$authkey"

      install_caddy_static
      write_caddyfile "$domain" "$origin" "$tls_mode" "$cert" "$key"

      open_firewall_vm

      if have systemctl; then
        systemctl restart caddy || true
        systemctl status caddy --no-pager || true
      else
        log "Start Caddy manually: /usr/local/bin/caddy run --config /etc/caddy/Caddyfile"
      fi

      log "VM done."
      log "Tip: set your Namecoin value to point .bit to this VM public IP."
      print_namecoin_json "${ip_override:-}"
      ;;
    home)
      ensure_tailscale
      tailscale_up "$authkey"

      if [ "$lockdown" = "1" ]; then
        lockdown_home_port "$service_port" "$allow_from"
        log "Home lockdown done."
      else
        log "Home done (no firewall lockdown requested)."
      fi

      log "Your home Tailscale IP is:"
      tailscale ip -4 || true
      ;;
    namecoin-json)
      print_namecoin_json "${ip_override:-}"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
