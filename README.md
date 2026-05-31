# Nitro Docker (2026 !)
Nitro docker is a quick-to-setup docker dev environment. It can be run on Windows, Linux or OSX just with a few commands

# Installation
- Install ``just`` from here: https://github.com/casey/just#installation
- Install docker desktop (and for windows, enable WSL support) from here: https://www.docker.com/get-started/
- Clone this repository
- Execute the following commands inside cloned repository
- `just install`
- `just start-all`
- Wait 5/10 minutes (it's important)
- Once nitro accessible on [http://127.0.0.1:1080?sso=123](http://127.0.0.1:1080?sso=123)
- You can extract all assets easily with the command `just extract-nitro-assets`

‼️ If you have have the 20% error, look at the console, maybe it miss the "ExternalText". Just extract assets: previous command ⬆️

## More commands
- `just restart-arcturus`: restart arcturus emulator
- `just restart-nitro`: restart nitro dev server (Craco in nitro-react)
- `just watch-arcturus`: watch the emulator output
- `just watch-nitro`: watch the nitro dev server output
- `just --list`: display all usefull commands <3

## More informations
### Mysql
Mysql server use these credentials:
```
      - MYSQL_ROOT_PASSWORD=arcturus_root_pw
      - MYSQL_USER=arcturus_user
      - MYSQL_PASSWORD=arcturus_pw
      - MYSQL_DATABASE=arcturus
```
The first database come from mysql/dumps, it's the base Arcturus database for 3.0.X with just a default SSO ticket (123).

### Arcturus
- Arcturus is stored in emulator/arcturus, it's just a submodule from krews.git. Each time you run the nitro-arcturus image, each time the emulator is recompiled. You can recompile manualy with the command `just recompile-arcturus`.
- The NitroWebSocket plugin is already added
- All the configuration can be found in `emulator/config.ini`

### Nitro
- Nitro is the folder for nitro dev server, assets, swf, converters...
- The nitro-image contains 3 server: assets server (for all *.nitro files), swf server from morningstar (who contain all current useful SWF) and nitro-dev server on nitro-react.
- All extracted assets come from nitro-swf and will be extracted in nitro-assets (the nitro converter use the swf server)
- All the configurations for nitro-react are in `nitro/configuration`. If you make some change, just make `just restart-nitro`

### Have fun <3

---

## Testing & Debug (Copilot / CI)

The repository ships a ready-to-use [Playwright](https://playwright.dev/) test environment that lets you run automated tests and capture screenshots of the Nitro React client without the full emulator/CMS stack.

### Prerequisites
- Docker & Docker Compose (same as the main setup)
- `just` (optional – you can also run the `docker-compose` commands directly)

### Run all client tests
```bash
just test-client
```
This command:
1. Builds the `nitro` service and starts the Vite dev server in Docker.
2. Waits until the dev server is healthy (first run: ~5–10 min for `yarn install`).
3. Runs all Playwright tests in headless Chromium.
4. Exits with the Playwright exit code (0 = all passed).

Screenshots are saved to `client-tests/screenshots/`.  
The HTML report is saved to `client-tests/test-results/`.

### Capture a screenshot only
```bash
just screenshot-client
```
Runs only tests tagged `@screenshot` and exits immediately.

### Run tests against an already-running client (host)
```bash
cd client-tests
npm install
BASE_URL=http://localhost:1080 npx playwright test
```

### Clean up test containers & volumes
```bash
just clean-client-tests
```

### Adding new tests
Edit or add files in `client-tests/tests/`. Tests follow standard Playwright syntax.  
Tag a test with `@screenshot` to include it in the `just screenshot-client` shortcut.
