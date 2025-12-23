set dotenv-path := ".env"

alias d := down
alias t := test
alias p := primary
alias s := secondary
alias sy := sync

# Bring up all nodes and initialize components.
dev: primary secondary init

# Bring up primary node.
primary:
  docker compose --profile primary up -d --wait

# Bring up secondary node.
secondary:
  docker compose --profile secondary up -d --wait

# Bring up view/network syncer.
sync:
  docker compose --profile sync up -d --wait

# Stop containers (keeps volumes).
down:
  docker compose --profile "*" down

# Stop containers and remove volumes (destroys LMDB state).
clean:
  docker compose --profile "*" down -v

# Configure Catalog Zone + TSIG sync.
init: init-secondary init-primary
  @echo "[init] done"

# Initialize secondary: import TSIG and setup catalog consumer.
init-secondary:
  #!/usr/bin/env bash
  set -euo pipefail
  shopt -s expand_aliases
  alias pdnsutil='docker exec pdns-secondary-pdns-1 pdnsutil'

  PRIMARY_IP=$(docker inspect -f '{{ '{{' }}range .NetworkSettings.Networks{{ '}}' }}{{ '{{' }}.IPAddress{{ '}}' }}{{ '{{' }}end{{ '}}' }}' pdns-primary-pdns-1)
  if [ -z "$PRIMARY_IP" ]; then PRIMARY_IP="127.0.0.1"; fi

  pdnsutil tsigkey import "$PDNS_TSIG_NAME" "$PDNS_TSIG_ALGO" "$PDNS_TSIG_SECRET"
  pdnsutil zone create-secondary "$PDNS_CATALOG_ZONE" "$PRIMARY_IP"
  pdnsutil zone set-kind "$PDNS_CATALOG_ZONE" consumer
  pdnsutil tsigkey activate "$PDNS_CATALOG_ZONE" "$PDNS_TSIG_NAME" consumer

# Initialize primary: setup producer and member zones, then wait for sync.
init-primary:
  #!/usr/bin/env bash
  set -euo pipefail
  shopt -s expand_aliases
  alias pdnsutil='docker exec pdns-primary-pdns-1 pdnsutil'

  SECONDARY_IP=$(docker inspect -f '{{ '{{' }}range .NetworkSettings.Networks{{ '}}' }}{{ '{{' }}.IPAddress{{ '}}' }}{{ '{{' }}end{{ '}}' }}' pdns-secondary-pdns-1)
  if [ -z "$SECONDARY_IP" ]; then SECONDARY_IP="127.0.0.1"; fi

  pdnsutil tsigkey import "$PDNS_TSIG_NAME" "$PDNS_TSIG_ALGO" "$PDNS_TSIG_SECRET"
  pdnsutil zone load "$PDNS_CATALOG_ZONE" "/zones/${PDNS_CATALOG_ZONE}.zone"
  pdnsutil add-record "$PDNS_CATALOG_ZONE" "$PDNS_CATALOG_ZONE" NS "ns2.${PDNS_CATALOG_ZONE}."
  pdnsutil replace-rrset "$PDNS_CATALOG_ZONE" "ns2.${PDNS_CATALOG_ZONE}" A 60 "$SECONDARY_IP"
  pdnsutil zone set-kind "$PDNS_CATALOG_ZONE" producer
  pdnsutil zone load "$PDNS_MEMBER_ZONE" "/zones/${PDNS_MEMBER_ZONE}.zone"
  pdnsutil add-record "$PDNS_MEMBER_ZONE" "$PDNS_MEMBER_ZONE" NS "ns2.${PDNS_MEMBER_ZONE}."
  pdnsutil replace-rrset "$PDNS_MEMBER_ZONE" "ns2.${PDNS_MEMBER_ZONE}" A 60 "$SECONDARY_IP"
  pdnsutil zone set-kind "$PDNS_MEMBER_ZONE" primary
  pdnsutil catalog set "$PDNS_MEMBER_ZONE" "$PDNS_CATALOG_ZONE"
  pdnsutil tsigkey activate "$PDNS_CATALOG_ZONE" "$PDNS_TSIG_NAME" producer
  pdnsutil tsigkey activate "$PDNS_MEMBER_ZONE" "$PDNS_TSIG_NAME" primary

# Validate replication by adding a record on primary and resolving it from secondary.
test wait_time="5":
  #!/usr/bin/env bash
  set -euo pipefail
  shopt -s expand_aliases
  alias pdnsutil='docker exec pdns-primary-pdns-1 pdnsutil'
  
  RANDOM_VAL=$(openssl rand -hex 8)
  FQDN="test.${PDNS_MEMBER_ZONE}"

  pdnsutil add-record "$PDNS_MEMBER_ZONE" "$FQDN" TXT 60 "\"$RANDOM_VAL\""
  pdnsutil increase-serial "$PDNS_MEMBER_ZONE"
  
  SECONDARY_IP=$(docker inspect -f '{{ '{{' }}range .NetworkSettings.Networks{{ '}}' }}{{ '{{' }}.IPAddress{{ '}}' }}{{ '{{' }}end{{ '}}' }}' pdns-secondary-pdns-1)
  if [ -z "$SECONDARY_IP" ]; then SECONDARY_IP="127.0.0.1"; fi

  echo "Waiting {{wait_time}}s for replication..."
  sleep {{wait_time}}
  
  dig TXT @"$SECONDARY_IP" "$FQDN" | grep "$RANDOM_VAL"
