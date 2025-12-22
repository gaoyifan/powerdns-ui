# PowerDNS UI

PowerDNS UI is a modern, fast, and feature-rich single-page application (SPA) designed for managing PowerDNS servers. Built with React, TypeScript, and Tailwind CSS, it provides a premium user experience for DNS administration, including split-horizon (Views) management and enhanced metadata support.

![Domains Page](docs/screenshots/domains_page.png)

## Project Goals

- **Direct Interoperation**: The primary goal of this project is to interoperate directly with the PowerDNS Local API.
- **Lightweight Interaction**: All logic resides in the client side, interacting with the standard PowerDNS HTTP API.

## Non-Goals

- **No Extra Backend**: This project explicitly avoids the use of any additional backend services or databases. It relies solely on the PowerDNS API for data persistence and state management.

## Key Features

- **Domain and Zone Management**: Full CRUD operations for DNS zones with a clean, unified interface.
- **Split-Horizon Support (Views)**: Robust management of PowerDNS Views, allowing different DNS responses based on the requester's network.
  ![Views Page](docs/screenshots/views_page.png)
- **Intelligent Network Mapping**: Visually map CIDR networks to specific Views.
- **Batch Synchronization**: 
    - Sync network-to-view mappings from remote URLs.
    - Priority-based conflict resolution.
    - Concurrency Control: Limited concurrent API requests to ensure stability and prevent resource exhaustion.
    - Real-time Progress: Live percentage tracking for batch update operations.
- **Enhanced Record Comments**:
    - Supports individual comments for multiple records of the same type and name.
    - Advanced Metadata: Uses MessagePack binary encoding to store structured metadata (type, content, comment) within PowerDNS TYPE65534 records.
    ![Domain Details with Comments](docs/screenshots/domain_details.png)
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
- npm or pnpm
- [just](https://github.com/casey/just) (optional, recommended for development)
- Docker & Docker Compose

### Fast Track (Development Environment)

This repository includes a pre-configured PowerDNS primary/secondary environment using Catalog Zones and TSIG.

1. **Prepare Environment**:
   ```bash
   cp .env.example .env
   ```

2. **Spin up and Test**:
   ```bash
   just up
   ```
   This command will:
   - Start a Primary PDNS node, a Secondary node, and the UI.
   - Automatically discover container IPs and configure Catalog Zone replication.
   - Run a replication test to ensure everything is wired correctly.

### Manual Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd pdns-ui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

## Advanced Deployment

### Independent Secondary Deployment
To deploy a Secondary node that maps directly to host port `53`, modify your `.env`:
```env
PDNS_SECONDARY_NETWORK_MODE=host
```

### Dynamic IP Discovery
The orchestration logic automatically sniffs container IPs and updates NS/A records in the zones. No static IP management is required in the `.env` file for standard Docker Bridge deployments.

## Testing & Quality

- **Tests**: `npm test` or `just test`
- **Build**: `npm run build`
- **Clean Environment**: `just clean`
