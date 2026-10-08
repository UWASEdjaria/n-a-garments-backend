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
app.use(cors({ origin: [process.env.FRONTEND_URL, 'http://localhost:3000'].filter((origin): origin is string => Boolean(origin)), }));
app.use(express.json());
app.use(morgan('dev'));

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerJson));

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'na-garments API is running' });
});

RegisterRoutes(app);

app.use(errorHandler);

export default app;
