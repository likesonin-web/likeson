import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import CustomerProfile from '../models/CustomerProfile.js';

// 1. Initialize dotenv to prevent "Missing ClientID" errors
dotenv.config();

// 2. Session Serialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// 3. Google Strategy Logic
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/users/google/callback",
    proxy: true // Crucial for production hosting (Render/AWS)
}, async (accessToken, refreshToken, profile, done) => {
    // Start a Mongoose session for atomic operations
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // Check if user exists by Google ID or Email
        let user = await User.findOne({ 
            $or: [
                { 'googleAuth.googleId': profile.id },
                { email: profile.emails[0].value }
            ] 
        }).session(session);

        if (user) {
            // If user exists by email but first time using Google, link the ID
            if (!user.googleAuth.googleId) {
                user.googleAuth.googleId = profile.id;
                user.googleAuth.isVerified = true;
                await user.save({ session });
            }
            await session.commitTransaction();
            return done(null, user);
        }

        // New User Creation Logic
        const newUser = {
            name: profile.displayName,
            email: profile.emails[0].value,
            avatar: profile.photos[0].value,
            role: 'customer', // Default role for social signups
            googleAuth: {
                googleId: profile.id,
                isVerified: true
            },
            isEmailVerified: true
        };

        const [createdUser] = await User.create([newUser], { session });

        // Create the linked Customer Profile automatically
        await CustomerProfile.create([{ 
            user: createdUser._id,
            snapshot: { primaryLanguage: 'English' } 
        }], { session });

        await session.commitTransaction();
        return done(null, createdUser);

    } catch (err) {
        await session.abortTransaction();
        return done(err, null);
    } finally {
        session.endSession();
    }
}));

export default passport;