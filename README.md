# Pi Zero Rampart Quiz

## Overview

This is a small educational Linux fundamentals quiz intended for a Raspberry Pi Zero or a compatible Linux host. Rampart serves the web interface and handles account operations, quiz delivery, and scoring. Two or more client computers can access it through a browser on the same trusted local network.

The project is also useful for teaching wireless-network security concepts: some Wi-Fi management and connection metadata can be observable over the air even when Wi-Fi encryption is enabled. That does **not** mean encrypted application payloads or private communications can simply be read. Use any packet-capture demonstrations only on networks and devices you own or have explicit permission to assess.

> **Hardware compatibility warning:** the original Raspberry Pi Zero uses ARMv6. Confirm that the Rampart release and operating-system image you choose support the exact Pi model and CPU architecture. This project has not been validated on physical Pi Zero hardware.

## Contents

- `server.js` — Rampart server, user registration/login, quiz endpoints, and scoring.
- `html/` — semantic HTML, Bulma CSS from jsDelivr, and browser JavaScript.
- `sample-quiz.json` — example quiz JSON.
- `scripts/check-updates.sh` — checks the remote Git repository for new commits; does not install them.
- `data/` — runtime JSON state, created/used by the application.

## 1. Prepare Raspberry Pi OS before cloning or copying

Start with an updated Raspberry Pi OS installation, connect the Pi to your network, then run:

```sh
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git unzip bash coreutils hostname iproute2 procps
```

`git` is needed if cloning the repository; `unzip` is needed if deploying the ZIP. Some packages may already be installed. Reboot if requested, then verify the OS and architecture:

```sh
cat /etc/os-release
uname -m
```

The original Pi Zero is ARMv6. Zero 2 W and newer models have different CPU architectures, so do not assume that the same Rampart binary will work on every model.

## 2. Install Rampart

Use the official documentation and installation method for the exact OS and CPU architecture:

<https://rampart.dev/>

Do not assume Rampart is available through the default `apt` repositories. Verify the executable after installing it:

```sh
command -v rampart
rampart --version
```

If `--version` is unsupported, use the method documented by Rampart. This application does not require Node.js, npm, Python, Ruby, or a database server unless the Rampart installation instructions for your chosen build explicitly require additional dependencies.

## 3. Deploy directly on the Raspberry Pi

Copy the project ZIP to the Pi, then:

```sh
cd ~
unzip pi-zero-rampart-quiz.zip
cd pi-zero-rampart-quiz
chmod +x run.sh
./run.sh
```

Keep the terminal open while the server runs. Press `Ctrl+C` to stop it. The server listens on TCP port `8088`.

Find the Pi's LAN address:

```sh
hostname -I
```

From either client computer, open `http://PI_IP_ADDRESS:8088/`, replacing `PI_IP_ADDRESS` with the Pi's actual address. A DHCP reservation can keep that address stable.

### Where Rampart serves HTML files

Apache commonly uses `/var/www/html` as its default document root. This app serves files from its own project `html/` directory; it does not need to be installed under `/var/www/html`.

For example, if the project is at `/opt/pi-zero-rampart-quiz`, the main page is `/opt/pi-zero-rampart-quiz/html/index.html`. The `server.js` configuration maps `/` to that directory. Keep `server.js`, `html/`, and `data/` together and start the app from the project directory. This is this application's configuration, not a universal Rampart default.

## 4. Run in a Linux virtual machine

Suggested starting resources: 1 virtual CPU, 1–2 GB RAM, and an 8–16 GB virtual disk. Create a Debian or other Linux guest supported by the Rampart build.

Inside the VM:

```sh
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git unzip bash coreutils hostname iproute2 procps
```

Install a Rampart build compatible with the guest OS and architecture using <https://rampart.dev/>. Then clone the actual repository:

```sh
git clone REPOSITORY_URL
cd pi-zero-rampart-quiz
chmod +x run.sh
./run.sh
```

Alternatively, copy and extract the ZIP as described above.

Choose VM networking according to how clients will connect:

- **Bridged:** the VM gets an address on the LAN; usually easiest for other devices to access.
- **NAT:** other LAN devices generally cannot reach the guest directly. Configure host port forwarding to guest TCP port `8088`, or use bridged mode.
- **Host-only:** usually permits access from the host, but not other LAN devices without extra routing.

Find the guest address with `hostname -I`. Open `http://VM_IP_ADDRESS:8088/` from a client that can reach the VM. Do not expose port `8088` directly to the public internet.

## 5. Run with Docker and Docker Compose

> **WARNING: EXPERIMENTAL DOCKER SUPPORT.** These instructions have not been tested against a real Rampart installation. You must supply a Rampart executable compatible with the image's Linux distribution and CPU architecture. Expect to adapt the Dockerfile and troubleshoot. Do not use this setup for production or important data. Back up the application data before testing.

Docker support packages the single Rampart application server; it does not introduce Node.js or another application runtime. Install Docker Engine and the Compose plugin using the official instructions: <https://docs.docker.com/engine/install/>.

Verify:

```sh
docker --version
docker compose version
```

The example Dockerfile expects a compatible Rampart executable at `vendor/rampart` in the project root. Obtain it using Rampart's official instructions and check any licensing restrictions before redistributing it.

Create `Dockerfile`:

```dockerfile
FROM debian:trixie-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \\
    && rm -rf /var/lib/apt/lists/*
COPY vendor/rampart /usr/local/bin/rampart
RUN chmod 0755 /usr/local/bin/rampart
COPY server.js /app/server.js
COPY html/ /app/html/
COPY sample-quiz.json /app/sample-quiz.json
RUN mkdir -p /app/data
EXPOSE 8088
CMD ["/usr/local/bin/rampart", "/app/server.js"]
```

Create `compose.yaml`:

```yaml
services:
  quiz:
    build: .
    image: pi-zero-rampart-quiz:local
    ports:
      - "8088:8088"
    volumes:
      - quiz-data:/app/data
    restart: unless-stopped

volumes:
  quiz-data:
```

Create `.dockerignore`:

```text
.git
data/
data-backup-*
*.zip
README.md
```

Build and run from the project root:

```sh
mkdir -p vendor
# Place the compatible Rampart executable at vendor/rampart first.
chmod +x vendor/rampart
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f quiz
```

Open `http://localhost:8088/` on the Docker host, or `http://DOCKER_HOST_IP:8088/` from another LAN device. Ensure the host firewall permits access only from the trusted network.

Stop the app with `docker compose down`. Rebuild after changing the code with `docker compose up -d --build`. The named `quiz-data` volume persists runtime data. `docker compose down -v` deletes that volume and its data; do not use it unless you intend to erase the data.

## 6. Accounts and security limitations

Create the first intended administrator account before students register, and inspect `data/admins.json` if the admin feature is enabled in the version you deploy. Back up the entire `data/` directory while the server is stopped:

```sh
cp -a data "data-backup-$(date +%Y%m%d-%H%M%S)"
```

This is a classroom demonstration, not a hardened production service. The prototype uses plain HTTP and simple SHA-256-based password/security-answer hashes that are not suitable for real accounts. Use throwaway credentials, never reuse real passwords or security answers, keep the service on a trusted isolated LAN, and do not expose it to the public internet. Bulma CSS is loaded from jsDelivr, so browsers need internet access for styling unless the stylesheet is served locally.

## 7. Nightly update-check script

`scripts/check-updates.sh` shallow-clones the remote repository to a temporary directory, compares the remote commit with the installed Git checkout when available, logs the result, and removes the temporary clone. It **only checks and reports**; it does not install updates or overwrite application files.

Install Git if needed:

```sh
sudo apt update
sudo apt install -y git
```

Run the script manually, replacing the example URL with the real repository URL:

```sh
chmod +x scripts/check-updates.sh
mkdir -p "$HOME/.local/state/pi-zero-rampart-quiz"
./scripts/check-updates.sh https://github.com/OWNER/REPOSITORY.git "$PWD"
```

Logs are written to `~/.local/state/pi-zero-rampart-quiz/update-check.log`.

To schedule a check every night at 1:00 AM, run `crontab -e` as the user who owns the app and add this line after replacing the repository URL and project path:

```cron
0 1 * * * /opt/pi-zero-rampart-quiz/scripts/check-updates.sh https://github.com/OWNER/REPOSITORY.git /opt/pi-zero-rampart-quiz
```

Cron uses the machine's local time zone. Confirm the job with `crontab -l`. This is an update checker, not an automatic updater; review changes and back up `data/` before manually deploying updates.

## Troubleshooting

- `rampart: command not found`: install Rampart or correct `PATH`.
- Architecture error: confirm that the Rampart build supports the exact Pi or VM CPU architecture.
- Browser cannot connect: check that the server is running, verify the address and port `8088`, and inspect firewall/network settings.
- Missing Bulma styling: check browser internet access to jsDelivr.
- Docker fails to start: verify the supplied binary's architecture and shared-library requirements.

## Project files

- `server.js` — Rampart server and quiz backend.
- `html/index.html` — semantic HTML and Bulma CDN reference.
- `html/app.css` — application styles.
- `html/app.js` — browser behavior.
- `sample-quiz.json` — example question data.
- `scripts/check-updates.sh` — nightly update checker.
- `data/` — runtime application state.
