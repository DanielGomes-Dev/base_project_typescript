import express, { Application, Request, Response } from 'express';

const app: Application = express();

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'ONLINE' });
});

export default app;
