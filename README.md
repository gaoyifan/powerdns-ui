# PowerDNS UI

PowerDNS UI is a modern, fast, and feature-rich single-page application (SPA) designed for managing PowerDNS servers. Built with React, TypeScript, and Tailwind CSS, it provides a premium user experience for DNS administration, including split-horizon (Views) management and enhanced metadata support.

## Project Goals

- **Direct Interoperation**: The primary goal of this project is to interoperate directly with the PowerDNS Local API.
- **Lightweight Interaction**: All logic resides in the client side, interacting with the standard PowerDNS HTTP API.

## Non-Goals

- **No Extra Backend**: This project explicitly avoids the use of any additional backend services or databases. It relies solely on the PowerDNS API for data persistence and state management.

## Key Features

- **Domain and Zone Management**: Full CRUD operations for DNS zones with a clean, unified interface.
- **Split-Horizon Support (Views)**: Robust management of PowerDNS Views, allowing different DNS responses based on the requester's network.
- **Intelligent Network Mapping**: Visually map CIDR networks to specific Views.
- **Batch Synchronization**: 
    - Sync network-to-view mappings from remote URLs.
    - Priority-based conflict resolution.
    - Concurrency Control: Limited concurrent API requests to ensure stability and prevent resource exhaustion.
    - Real-time Progress: Live percentage tracking for batch update operations.
- **Enhanced Record Comments**:
    - Supports individual comments for multiple records of the same type and name.
    - Advanced Metadata: Uses MessagePack binary encoding to store structured metadata (type, content, comment) within PowerDNS TYPE65534 records.
- **Zone File Import**: Bulk import records from BIND-style zone files using an intuitive modal with preview capabilities.
- **Extensive Record Support**: Support for A, AAAA, ALIAS, CAA, CNAME, DNAME, HTTPS, MX, NAPTR, NS, PTR, SOA, SPF, SRV, SSHFP, SVCB, TLSA, and TXT.
- **Modern UI and UX**:
    - Responsive design powered by Tailwind CSS.
    - Premium aesthetics with glassmorphism, smooth animations, and a polished dark-mode compatible palette.
    - Global notification system and standard modal components.

## Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Serialization**: MessagePack (via @msgpack/msgpack)

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- A running PowerDNS server with the HTTP API enabled.

### Installation

1. Clone the repository:
    ```bash
    git clone <repository-url>
    cd pdns-ui
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

### Development

Start the development server:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

Build for production:
```bash
npm run build
```

## Docker Support

The project includes a Dockerfile and docker-compose.yml for easy deployment using Caddy as a high-performance web server and reverse proxy.

```bash
docker compose up -d --build
```
