import jwt from 'jsonwebtoken';
// --- HELPER: GENERATE TOKEN ---
export const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { 
        expiresIn: process.env.JWT_EXPIRES_IN || '30d' // Falls back to 30d if .env is missing
    });
};