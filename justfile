set windows-powershell := true

default:
  @just --list

# Install all easily
install:
  git submodule init
  git submodule update

# Start Mysql, Arcturus Emulator & Nitro (not in daemon mod)
start-all:
  docker-compose up

# Close docker containers, remove images and clean volumes
clean-docker:
  docker-compose down
  docker image rm nitro-docker-arcturus -f
  docker image rm nitro-docker-nitro -f
  docker image rm nitro-docker-cms -f
  docker volume rm nitro-docker_volume-arcturus-maven-repo
  docker volume rm nitro-docker_volume-arcturus-target
  docker volume rm nitro-docker_volume-cms-vendor
  docker volume rm nitro-docker_volume-mysql
  docker volume rm nitro-docker_volume-nitro-converter-node-modules
  docker volume rm nitro-docker_volume-nitro-react-node-modules

# Open the MySQL console
mysql:
  docker exec -it arcturus bash -c "mysql -h mysql -u arcturus_user -parcturus_pw arcturus"

# Restart Arcturus Emulator
restart-arcturus:
  docker exec arcturus supervisorctl restart arcturus-emulator

# Stop Arcturus Emulator
stop-arcturus:
  docker exec arcturus supervisorctl stop arcturus-emulator

# Start Arcturus Emulator
start-arcturus:
  docker exec arcturus supervisorctl start arcturus-emulator

# Recompile Arcturus Emulator
recompile-arcturus:
  docker exec arcturus supervisorctl stop arcturus-emulator
  docker exec -it arcturus bash -c "cd /app/arcturus; mvn package; cp /app/config.ini /app/arcturus/target/config.ini;"
  docker exec arcturus supervisorctl start arcturus-emulator

# Watch Arcturus's output
watch-arcturus:
  docker exec arcturus supervisorctl tail -f arcturus-emulator

# Enter in the Arcturus's shell:
shell-arcturus:
  docker exec -it arcturus bash

# Restart Nitro dev server
restart-nitro:
  docker exec nitro supervisorctl stop nitro-dev-server
  docker exec nitro bash -c "cp /app/configuration/nitro-react/public/* /app/nitro-react/public/"
  docker exec nitro supervisorctl start nitro-dev-server

# Stop Nitro Dev Server
stop-nitro:
  docker exec nitro supervisorctl stop nitro-dev-server

# Start Nitro Dev Server
start-nitro:
  docker exec nitro supervisorctl start nitro-dev-server

# Enter in the Nitro's shell
shell-nitro:
  docker exec -it nitro bash

# Watch Nitro dev server's output
watch-nitro:
  docker exec nitro supervisorctl tail -f nitro-dev-server

# Restart CMS
restart-cms:
  docker-compose restart cms

# Enter in the CMS shell
shell-cms:
  docker exec -it cms sh

# Watch CMS output
watch-cms:
  docker logs -f cms


# Run the full Playwright test suite against the Nitro React client.
# The first run may take 5-10 minutes while yarn installs dependencies.
# Subsequent runs are fast thanks to Docker layer and volume caching.
# Screenshots are saved to client-tests/screenshots/
# HTML report is saved to client-tests/test-results/
test-client:
  docker-compose -p nitro-docker-test -f docker-compose.client-test.yaml up --build --exit-code-from client-tests --abort-on-container-exit

# Run only the screenshot tests (tagged @screenshot) against the Nitro client.
# Starts the nitro service automatically if it is not already running, then
# waits for the healthcheck before launching Playwright.
screenshot-client:
  docker-compose -p nitro-docker-test -f docker-compose.client-test.yaml run --build --rm client-tests npx playwright test --grep @screenshot
  docker-compose -p nitro-docker-test -f docker-compose.client-test.yaml down

# Stop and clean up client test containers and volumes.
clean-client-tests:
  docker-compose -p nitro-docker-test -f docker-compose.client-test.yaml down -v
  docker image rm nitro-docker-test-client-tests -f
  docker image rm nitro-docker-test-nitro -f

# Extract nitro assets from SWF
extract-nitro-assets:
  docker exec -it nitro bash -c "cp /app/configuration/nitro-converter/configuration.json /app/nitro-converter/configuration.json"
  docker exec -it nitro bash -c "cd /app/nitro-converter; yarn ts-node-dev --transpile-only src/Main.ts"
  docker exec -it nitro bash -c "echo 'Moving assets...'"
  docker exec -it nitro bash -c "rsync -r /app/nitro-converter/assets/* /app/nitro-assets/"
  docker exec -it nitro bash -c "echo 'Done !'"
