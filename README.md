# School Lost and Found

FastAPI lost-and-found app designed for a Raspberry Pi Docker Swarm cluster.

This README explains the full beginner deployment path: what Swarm does, why the app can run on multiple Pis, why PostgreSQL is separate, how to deploy the stack, and how to verify that the replicas are actually running.

## Mental Model

Docker Swarm is a cluster manager for containers.

That means Swarm can take one service, such as this web app, and run multiple copies of it across several Raspberry Pis. Those copies are called replicas.

```text
Users
  |
  v
Swarm Routing Mesh
  |
  v
web replicas across Pis
  |
  v
shared PostgreSQL database
```

In this project:

- Swarm replicates the `web` containers across Raspberry Pis.
- Swarm load balances traffic automatically through its routing mesh.
- The web app is stateless, meaning a web container does not need to keep permanent data on its own local filesystem.
- PostgreSQL is the shared state layer, meaning it stores users, sessions, items, claims, uploads, and other important data.
- Users can hit different Pis and still see the same data because every web replica connects to the same PostgreSQL database service named `db`.

Swarm's job is to place containers, restart containers, and route traffic. PostgreSQL's job is to store the data. Swarm is not a database, and PostgreSQL is not the traffic router.

Example:

```text
User A opens http://192.168.1.101:8000
User B opens http://192.168.1.102:8000

Swarm may send those requests to different web replicas.
Both replicas read and write the same PostgreSQL database.
Both users see the same lost-and-found data.
```

Login sessions work the same way. The browser keeps a session token, and any web replica can check that token against the shared PostgreSQL database. Uploaded images are stored through the database-backed upload path too, so a user does not lose access just because a different replica handles the next request.

Swarm does not sync files or databases between Pis. Swarm moves and restarts containers. PostgreSQL stores the shared data.

## What This Stack Runs

```text
backend/              FastAPI app, database models, AI helpers
frontend/             Static frontend served by FastAPI
tests/                Python unit tests
Dockerfile            ARM-compatible Python app image
docker-compose.yml    Docker Swarm stack file
requirements.txt      Python dependencies
.env.example          Local development defaults
```

The Swarm stack contains:

- `web`: the replicated FastAPI/Gunicorn service.
- `db`: one PostgreSQL database service.
- `lostfound_net`: an overlay network that lets containers talk across Pis.
- `db_data`: a Docker volume for PostgreSQL data.

Local-only runtime directories such as `data/`, `uploads/`, and `logs/` are not part of the Swarm architecture.

## Before You Start

You need:

1. At least two Raspberry Pis on the same network.
2. 64-bit Raspberry Pi OS, because the image command below builds for `linux/arm64`.
3. SSH access to each Pi.
4. A stable LAN IP for the manager Pi, such as `192.168.1.100`.
5. A Docker Hub account or another container registry that every Pi can pull from.

In the examples below:

- Manager Pi IP: `192.168.1.100`
- Stack name: `mystack`
- Docker image: `yourname/lostfound:20260529102030-a1b2c3d4e5f6`

Replace those values with your real values.

## Step 1: Install Docker On Every Pi

Do this on the manager Pi and on every worker Pi.

This is the simple beginner/lab install path. For a stricter production install, use Docker's official apt repository instructions for Debian/Raspberry Pi OS.

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

Log out and back in, or reboot:

```bash
sudo reboot
```

After reconnecting, check Docker:

```bash
docker version
docker run hello-world
```

If `docker version` says permission denied, your user group change has not taken effect yet. Log out and back in again.

## Step 2: Initialize Swarm On The Manager Pi

Pick one Pi to be the manager.

The manager is the control node. It stores the Swarm cluster state and decides where services should run. It can also run containers unless you later tell Docker not to.

Run this only on the manager Pi:

```bash
docker swarm init --advertise-addr 192.168.1.100
```

Use the manager Pi's real LAN IP after `--advertise-addr`.

Do not use `127.0.0.1`.
Do not use a temporary IP that may change tomorrow.
For a home or school network, it is best to reserve the manager Pi's IP in your router.

## Step 3: Join Worker Pis

On the manager Pi, print the worker join command:

```bash
docker swarm join-token worker
```

Docker will print a command that looks like this:

```bash
docker swarm join --token SWMTKN-1-exampletoken 192.168.1.100:2377
```

Copy the command Docker prints.

Then run that copied command on each worker Pi.

A worker Pi runs containers when the manager asks it to. A worker does not control the cluster.

Do not run `docker swarm init` on worker Pis. Workers use `docker swarm join`.

## Step 4: Verify The Cluster

Run this on the manager Pi:

```bash
docker node ls
```

You should see one row for each Pi.

Important words in the output:

- `Ready`: Docker can talk to that node.
- `Active`: Swarm is allowed to run containers on that node.
- `Leader`: this manager is currently leading the Swarm control plane.
- `Worker`: a node that runs containers but does not manage the cluster. In `docker node ls`, workers usually have an empty `MANAGER STATUS` column.

If a worker is missing, it probably did not join successfully or cannot reach the manager on the network.

## Step 5: Choose The Pi That Stores PostgreSQL Data

The database is intentionally separate from the web replicas.

The web replicas are disposable. Swarm may restart them, replace them, or move them to another Pi. The database should live on one known Pi with persistent storage.

Pick the Pi that should hold the PostgreSQL Docker volume. A Pi with an SSD is better than a Pi using only an SD card.

First, find the node name:

```bash
docker node ls
```

Then label that node:

```bash
docker node update --label-add lostfound.db=true <DB_NODE_NAME>
```

Example:

```bash
docker node update --label-add lostfound.db=true pi-manager
```

The `docker-compose.yml` file requires this label. Without it, the `db` service will stay pending because Swarm does not know which Pi is allowed to run PostgreSQL.

## Step 6: Build And Push The Web Image From The Mac

This part is very important:

Swarm does not build images.

When you run `docker stack deploy`, Swarm tells each node to run an image. Every node must be able to pull that same image.

The deterministic pipeline is:

1. The Mac builds a Pi-compatible image.
2. The Mac tags it as `registry/lostfound:<version>`.
3. The Mac pushes it to a registry the Pis can pull from.
4. The Pi manager deploys that exact tag.

On the Mac, use Docker Desktop's `desktop-linux` context and set a registry namespace:

```bash
docker login
docker context use desktop-linux
IMAGE_REGISTRY=yourname ./build.sh
```

Use `IMAGE_REGISTRY=docker.io/yourname` for Docker Hub, or a private registry such as `IMAGE_REGISTRY=clanker:5000` if all Swarm nodes can pull from it.

`build.sh` writes the exact image tag to `.deploy/lostfound-image.env` and prints it. The recommended image naming scheme is:

```text
<registry-or-namespace>/lostfound:<YYYYMMDDHHMMSS>-<git-sha>
```

Example:

```text
yourname/lostfound:20260529102030-a1b2c3d4e5f6
```

For a private registry or private Docker Hub image, make sure every node can pull the image. You may need to log in on each Pi or deploy with `--with-registry-auth`.

## Step 7: Set Environment Variables

Run these on the manager Pi before deploying the stack:

```bash
export APP_IMAGE='yourname/lostfound:20260529102030-a1b2c3d4e5f6'
export POSTGRES_PASSWORD='change-this-to-a-long-random-database-password'
export ADMIN_USERNAME='admin'
export ADMIN_PASSWORD='change-this-admin-password'
export WEB_REPLICAS=2
export PUBLISHED_PORT=8000
```

What each variable means:

- `APP_IMAGE`: the web image every Pi will pull. This comes from the image you pushed in the previous step.
- `POSTGRES_PASSWORD`: the PostgreSQL password. The `db` service uses it, and the `web` service uses it in `DATABASE_URL` to connect to `db`.
- `ADMIN_USERNAME`: the first admin username. The app uses this only to bootstrap an admin when no admin exists yet.
- `ADMIN_PASSWORD`: the first admin password. Use a real password, not the example value.
- `WEB_REPLICAS`: how many web containers Swarm should run.
- `PUBLISHED_PORT`: the port users open in their browser on any Swarm node.

Important:

- Set `POSTGRES_PASSWORD` before the first deploy.
- Do not casually change `POSTGRES_PASSWORD` after PostgreSQL has already created its database volume.
- Use the exact `APP_IMAGE` tag emitted by `build.sh`; do not deploy `latest`.
- This stack has `max_replicas_per_node: 1` for the web service, so `WEB_REPLICAS=2` needs at least two available nodes. `WEB_REPLICAS=5` needs at least five available nodes unless you edit that placement rule.

## Step 8: Deploy The Stack

Run this on `clanker`, the Swarm manager, from the project directory:

```bash
./deploy.sh
```

`deploy.sh` validates that it is running on `clanker`, that Docker Desktop is not an active Swarm node, and that at least one Ready/Active worker exists. It then pulls `APP_IMAGE` and runs `docker stack deploy -c docker-compose.yml mystack`.

This command creates:

- An overlay network named `mystack_lostfound_net`.
- A PostgreSQL service named `mystack_db`.
- A replicated web service named `mystack_web`.
- The published app port on the Swarm routing mesh.

Swarm then distributes the web replicas across available Pis automatically.

## Step 9: Open The App

Open the app from any Swarm node IP:

```text
http://<ANY_SWARM_NODE_IP>:8000
```

Examples:

```text
http://192.168.1.100:8000
http://192.168.1.101:8000
http://192.168.1.102:8000
```

The Pi you connect to does not have to be the Pi that is running the web replica that handles your request.

That is Swarm's routing mesh:

1. A user connects to port `8000` on any Pi in the Swarm.
2. Swarm accepts the request.
3. Swarm forwards the request to a healthy `web` replica.
4. The `web` replica reads or writes data in the shared PostgreSQL database.

That is why users can hit different Pis and still see the same data.

## Step 10: Verify The Deployment

Run these on the manager Pi.

List services:

```bash
docker service ls
```

Look for:

```text
mystack_web   2/2
mystack_db    1/1
```

List all stack tasks:

```bash
docker stack ps mystack
```

See which Pi runs each web replica:

```bash
docker service ps mystack_web
```

Cleaner view:

```bash
docker service ps mystack_web --format 'table {{.Name}}\t{{.Node}}\t{{.CurrentState}}\t{{.Error}}'
```

See where PostgreSQL is running:

```bash
docker service ps mystack_db --format 'table {{.Name}}\t{{.Node}}\t{{.CurrentState}}\t{{.Error}}'
```

Read web logs from all replicas:

```bash
docker service logs mystack_web
```

Read database logs:

```bash
docker service logs mystack_db
```

Check the app health endpoint:

```bash
curl http://<ANY_SWARM_NODE_IP>:8000/health
```

Confirm the web service connects to PostgreSQL by service name:

```bash
docker service inspect mystack_web --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep DATABASE_URL
```

It should contain:

```text
@db:5432/lostfound
```

It should not contain:

```text
localhost
```

Inside a container, `localhost` means that same container, not the database service.

## Step 11: Scale Web Replicas

To run five web replicas:

```bash
docker service scale mystack_web=5
```

Then check placement:

```bash
docker service ps mystack_web --format 'table {{.Name}}\t{{.Node}}\t{{.CurrentState}}\t{{.Error}}'
```

Swarm will create or remove web containers until the actual replica count matches the desired replica count.

Swarm will also redistribute replicas automatically when nodes are available.

Remember:

- Scaling `mystack_web` adds more web app containers.
- It does not create more databases.
- All web replicas still use the same shared PostgreSQL database.
- Because this stack uses `max_replicas_per_node: 1`, five web replicas need five available Swarm nodes unless you change that rule.

## Step 12: Test Failover

A simple failover test:

1. Make sure you have more available nodes than required web replicas.
2. Turn off one worker Pi that is running a web replica.
3. Wait for Swarm to notice the node is down.
4. Check where the web replicas are running now.

Run:

```bash
docker service ps mystack_web
```

You should see Swarm start a replacement replica on another available Pi.

If a replacement stays `Pending`, check whether there is another available node that is allowed to run a web replica. With `max_replicas_per_node: 1`, Swarm will not place two web replicas on the same Pi.

The important idea:

- A web container can disappear.
- Swarm can create a new one somewhere else.
- Users still see the same data because the data is in PostgreSQL, not inside the web container.

## Important Warnings

Read these before changing the stack:

- Do not store uploads on the local container filesystem in Swarm.
- Do not use SQLite for replicated web replicas.
- Swarm does not sync files automatically between Pis.
- Database state must be shared.
- Containers may move between Pis at any time.
- Do not scale `mystack_db` like the web service. This compose file is designed for one PostgreSQL database service with one persistent volume.
- Back up the PostgreSQL volume. Swarm scheduling is not the same thing as database backup.

Why these warnings matter:

- If replica A saves a file on Pi 1, replica B on Pi 2 will not automatically have that file.
- If each replica uses its own SQLite file, users will see different data depending on which replica handled the request.
- If a container is recreated, files stored only inside that container can disappear.

This project avoids those problems in Swarm by using:

- `DATABASE_URL=postgresql+psycopg://...@db:5432/lostfound`
- `UPLOAD_STORAGE_BACKEND=database`
- `LOG_TO_STDOUT=1`

## Beginner Troubleshooting

### Worker stuck joining

Symptoms:

- `docker swarm join ...` hangs or fails.
- The worker does not appear in `docker node ls`.

Check:

```bash
docker swarm join-token worker
docker node ls
```

Common fixes:

- Make sure the worker can ping the manager IP.
- Make sure you used the manager's real LAN IP, not `127.0.0.1`.
- Make sure the manager allows port `2377/tcp`.
- Make sure the worker and manager are on the same network or can route to each other.

### Required Swarm ports are blocked

Swarm needs these ports between nodes:

```text
2377/tcp   cluster management, mainly workers talking to managers
7946/tcp   node discovery and control traffic
7946/udp   node discovery and control traffic
4789/udp   overlay network traffic
```

If you use `ufw`, examples are:

```bash
sudo ufw allow 2377/tcp
sudo ufw allow 7946/tcp
sudo ufw allow 7946/udp
sudo ufw allow 4789/udp
```

Port `2377/tcp` is required on manager nodes. The other Swarm ports are needed between Swarm nodes.

### Wrong advertise IP

Symptoms:

- Workers cannot join.
- Nodes joined before, but now cannot communicate.
- You initialized Swarm with the wrong network interface or an IP that changed.

Check the manager IP:

```bash
ip addr
docker node ls
```

For a fresh lab cluster, the simplest fix is often to recreate the Swarm with the correct stable IP. Do this only if you are okay removing the current Swarm setup:

```bash
docker stack rm mystack
docker swarm leave --force
docker swarm init --advertise-addr 192.168.1.100
```

Then rejoin the workers using a fresh `docker swarm join-token worker` command.

### Image pull failures

Symptoms:

- `mystack_web` shows `0/2`, `1/2`, or tasks restarting.
- `docker service ps mystack_web` shows image pull errors.

Check:

```bash
docker service ps mystack_web --no-trunc
docker service logs mystack_web
```

Common fixes:

- Confirm the image name in `APP_IMAGE` is correct.
- Confirm the image was pushed to Docker Hub or your registry.
- Confirm the image supports Raspberry Pi ARM64.
- If the image is private, run `docker login` and redeploy with `--with-registry-auth`.
- Try pulling the image directly on a worker Pi:

```bash
docker pull yourname/lostfound:20260529102030-a1b2c3d4e5f6
```

### Replicas not starting

Check service state:

```bash
docker service ls
docker stack ps mystack
docker service ps mystack_web --no-trunc
docker service ps mystack_db --no-trunc
```

Common causes:

- The database node label is missing.
- `POSTGRES_PASSWORD` was not set before deploy.
- The image cannot be pulled.
- There are not enough nodes for `WEB_REPLICAS` because `max_replicas_per_node: 1` is enabled.
- The database is still starting.

Check whether the database label exists:

```bash
docker node inspect <DB_NODE_NAME> --format '{{json .Spec.Labels}}'
```

If needed, add it:

```bash
docker node update --label-add lostfound.db=true <DB_NODE_NAME>
```

### App opens on one Pi but not another

Check:

- The app port is `PUBLISHED_PORT`, default `8000`.
- Your firewall allows that port on the Pi you are trying to open.
- The node is still in the Swarm and is `Ready`.

Commands:

```bash
docker node ls
docker service ls
curl http://<ANY_SWARM_NODE_IP>:8000/health
```

### How to check logs

Web logs:

```bash
docker service logs mystack_web
```

Database logs:

```bash
docker service logs mystack_db
```

Follow logs live:

```bash
docker service logs -f mystack_web
```

See detailed task errors:

```bash
docker service ps mystack_web --no-trunc
```

## Rolling Updates

Build and push a new ARM image tag from the Mac:

```bash
IMAGE_REGISTRY=yourname ./build.sh
```

Deploy that exact image from `clanker`:

```bash
APP_IMAGE=yourname/lostfound:20260529102030-a1b2c3d4e5f6 ./deploy.sh
docker service ps mystack_web
docker service logs mystack_web
```

## Local Development

Local development can still use SQLite and filesystem uploads:

```bash
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn backend.backend:app --host 0.0.0.0 --port 8000
```

Run tests:

```bash
.venv/bin/python -m unittest discover -s tests
```

SQLite is for local development only. Do not use SQLite for a replicated Swarm deployment.

## Ollama

AI features are optional.

In Swarm, `OLLAMA_HOST=http://localhost:11434` is wrong because `localhost` means the web container itself.

For Docker Desktop on the same Mac as Ollama:

```bash
export SWARM_OLLAMA_HOST=http://host.docker.internal:11434
./deploy.sh
```

For Raspberry Pis calling Ollama on your Mac, first make Ollama listen on the Mac's LAN interface. Restart Ollama after setting this:

```bash
launchctl setenv OLLAMA_HOST 0.0.0.0:11434
```

Then set the Pi deployment URL to the Mac's LAN IP:

```bash
export SWARM_OLLAMA_HOST=http://<MAC_LAN_IP>:11434
./deploy.sh
```

Verify from a Pi before deploying:

```bash
curl http://<MAC_LAN_IP>:11434/api/tags
```

If you deploy an Ollama service on the overlay network instead, use `SWARM_OLLAMA_HOST=http://ollama:11434`.
