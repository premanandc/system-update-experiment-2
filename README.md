# System Update Management Application

A comprehensive application for system administrators to manage updates across a fleet of devices.

## Project Overview

This application allows system administrators to:

- Manage devices (servers, workstations, network equipment, etc.)
- Track software packages and their versions
- Create and manage update plans
- Deploy updates to devices in batches
- Monitor update executions

## Domain Model

The core entities in this system are:

1. **Devices**: Physical or virtual systems that can receive updates
2. **Packages**: Software components that can be installed on devices
3. **Updates**: Planned changes to systems involving specific packages
4. **Device-Package Relationships**: Tracks which packages are installed on which devices
5. **Plans**: Structured strategies for deploying updates across devices
6. **Executions**: Records of update operations that have been performed
7. **Batches**: Groups of devices that should receive updates together

## Project Structure

- `/prisma` - Database schema and migrations
- `/src/models` - Domain models
- `/src/services` - Business logic services
- `/src/__tests__` - Test files

## Tech Stack

- TypeScript
- Prisma ORM
- SQLite database
- Jest for testing

## Development

### Prerequisites

- Node.js 16+
- npm

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`

### Database

The application uses SQLite for simplicity in development. The database file is located at `prisma/dev.db` (after creation).

### Testing

Tests follow the TDD approach. Run tests with:

```bash
npm test
```

## License

MIT 