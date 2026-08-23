import express, { Application, Request, Response } from 'express';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const app: Application = express();

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'ONLINE' });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
