import dotenv from 'dotenv';
import path from 'path';

// Load .env from root directory
dotenv.config();

// Direct check to prevent "Token Invalid" due to missing secret
if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in .env file");
    process.exit(1);
}