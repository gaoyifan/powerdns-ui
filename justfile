set dotenv-path := ".env"
alias d := down
alias t := test

# Format code using Prettier.
fmt:
  npx prettier --write "src/**/*.{ts,tsx,css}"

# Run tests
test:
  npm test

# Bring up PDNS and UI.
# Bring up PDNS and UI.
up:
  docker compose up -d --wait

# Stop containers (keeps volumes).
down:
  docker compose down

# Stop containers and remove volumes (destroys LMDB state).
clean:
  docker compose down -v

