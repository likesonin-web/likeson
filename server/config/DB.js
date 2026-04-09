// This file is responsible for establishing a connection to the MongoDB database.

import mongoose from 'mongoose';
// No need for dotenv.config() here, it's already called in index.js

/**
 * Connects to the MongoDB database using the connection string from environment variables.
 * @returns {Promise<void>} A promise that resolves when the connection is successful.
 */
const connectDB = async () => {
    try {
        // Log a message to indicate that the connection is being attempted.
        console.log('Connecting to MongoDB...');

        const conn = await mongoose.connect(process.env.MONGODB_URI);

        // Add a success log
        console.log(`MongoDB Connected: ${conn.connection.host}`);

    } catch (error) {
        // Log an error message and exit the process if the connection fails.
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;