# Notification Service

A microservice for handling notifications in the trading platform. This service integrates with the strategy management system to send notifications about order executions, strategy status changes, and system alerts.

## Features

- Multiple notification channels:
  - Email notifications
  - SMS notifications
  - Push notifications (mobile)
- User preferences for notification types and channels
- Notification history and status tracking
- RESTful API for notification management
- RabbitMQ integration for event-driven notifications

## Architecture

The notification service is designed as a microservice that:

1. Listens to RabbitMQ for order completion events
2. Processes notifications based on user preferences
3. Sends notifications through configured channels
4. Stores notification history in MongoDB
5. Provides APIs for notification management

## Prerequisites

- Node.js 16+
- MongoDB
- RabbitMQ
- SMTP server (for email notifications)
- Twilio account (for SMS notifications)
- Firebase account (for push notifications)

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example`
4. Start the service:
   ```
   npm start
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | HTTP server port | 3003 |
| NODE_ENV | Environment (development/production) | development |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/trading-platform |
| JWT_SECRET | Secret for JWT verification | |
| INTERNAL_SERVICE_TOKEN | Token for internal service communication | |
| RABBITMQ_URI | RabbitMQ connection string | amqp://localhost |
| EMAIL_SERVICE | SMTP server address | |
| EMAIL_USER | SMTP username | |
| EMAIL_PASSWORD | SMTP password | |
| SMS_API_KEY | Twilio account SID | |
| SMS_API_SECRET | Twilio auth token | |
| FIREBASE_PROJECT_ID | Firebase project ID | |
| FIREBASE_CLIENT_EMAIL | Firebase client email | |
| FIREBASE_PRIVATE_KEY | Firebase private key | |

## API Endpoints

### User Endpoints

| Method | URL | Description | Auth Required |
|--------|-----|-------------|---------------|
| GET | /api/notifications | Get user notifications | Yes |
| GET | /api/notifications/:id | Get notification by ID | Yes |
| PATCH | /api/notifications/:id/read | Mark notification as read | Yes |
| DELETE | /api/notifications/:id | Delete notification | Yes |
| GET | /api/notifications/preferences | Get user notification preferences | Yes |
| PUT | /api/notifications/preferences | Update user notification preferences | Yes |
| POST | /api/notifications/test | Send test notification (dev only) | Yes |

### Internal Service Endpoints

| Method | URL | Description | Auth Required |
|--------|-----|-------------|---------------|
| POST | /api/notifications/send | Send a notification | Service Token |
| POST | /api/notifications/batch | Send multiple notifications | Service Token |

## RabbitMQ Integration

The service listens to the following RabbitMQ topics:

- Exchange: `order_events`
- Routing key: `order.completed`

Example message format:

```json
{
  "userId": "user123",
  "strategyId": "5f7d1e3b9d31162e78d5b1f5",
  "notificationType": "ORDER_EXECUTED",
  "symbol": "AAPL",
  "orderType": "MARKET",
  "side": "BUY",
  "price": 150.25,
  "quantity": 10
}
```

## Docker Deployment

Build and run with Docker:

```
docker build -t notification-service .
docker run -p 3003:3003 --env-file .env notification-service
```

Or use docker-compose:

```
docker-compose up -d
```

## Integration with Strategy Manager

To integrate with the Strategy Manager service:

1. Configure the Order Placement service to publish events to the RabbitMQ exchange
2. Ensure JWT tokens are compatible between services
3. Set up the internal service token for direct API communication

## Development

Start in development mode with hot reload:

```
npm run dev
```

Run tests:

```
npm test
```