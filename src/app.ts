import express, { Application, Request, Response } from 'express';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import apiRoutes from './routes/index'

const app: Application = express();

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'ONLINE' });
});

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
