import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const parsedPort = Number.parseInt(process.env.PORT ?? '', 10);

export const port = Number.isFinite(parsedPort) ? parsedPort : 3000;
