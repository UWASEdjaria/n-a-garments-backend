import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { RegisterRoutes } from './generated/routes.js';
import swaggerJson from './generated/swagger.json' with { type: 'json' };
import { errorHandler } from './middleware/error.middleware.js';

const app: Application = express();

app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://nagarments.com',
  'https://www.nagarments.com',
  'https://na-garments-frontend.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
].filter((origin): origin is string => Boolean(origin));

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
  },
}));
app.use(morgan('dev'));

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerJson));

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'nagarments API is running' });
});

app.head('/payments/webhook/kpay', (_req, res) => {
  res.sendStatus(200);
});

RegisterRoutes(app);

app.use(errorHandler);

export default app;


