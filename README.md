# Ethereum Cryptocurrency Bot

This project is a cryptocurrency bot, specifically for Ethereum, built using NestJS, a Node.js framework. The bot interacts with the Ethereum blockchain and other services to monitor and analyze token transactions.

## Key Features

1. **Pair Creation Listener**: Listens for 'PairCreated' events on the Ethereum blockchain. When a new pair is created, it fetches the contract details and extracts relevant information.

2. **Token Monitoring**: Monitors tokens for significant events such as price changes and potential 'rug pulls'.

3. **Scheduled Tasks**: Runs several scheduled tasks to post top gainers, check and fill initial token prices, check for rug pulls, and send daily reports.

4. **Telegram Integration**: Integrates with Telegram to send notifications about new pairs and other significant events.

5. **Data Persistence**: Uses TypeORM for data persistence, storing information about tokens and their events in a database.

6. **Error Handling and Retries**: Includes robust error handling, including a function to retry operations with exponential backoff to handle temporary issues.

## Tech Stack

- TypeScript
- NestJS
- Node.js
- TypeORM
- PostgreSQL
- Telegraf

## Getting Started

1. Clone the repository
2. Install dependencies using `yarn install`
3. Start the bot using `yarn start`

## Docker

This project includes a Dockerfile and docker-compose for containerization.