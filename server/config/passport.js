import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import CustomerProfile from '../models/CustomerProfile.js';

// Ensure this runs, but ideally, move this to the very top of your main server.js file.
dotenv.config();
console.log("CHECKING SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "IT EXISTS" : "IT IS UNDEFINED");
if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("FATAL: GOOGLE_CLIENT_SECRET is missing. Check your .env file and import order.");
}
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
    // Use an absolute URL defined in your .env file to match your Google Console exactly
    callbackURL: process.env.GOOGLE_CALLBACK_URL, 
    proxy: true 
}, async (accessToken, refreshToken, profile, done) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        let user = await User.findOne({ 
            $or: [
                { 'googleAuth.googleId': profile.id },
                { email: profile.emails[0].value }
            ] 
        }).session(session);

        if (user) {
            if (!user.googleAuth.googleId) {
                user.googleAuth.googleId = profile.id;
                user.googleAuth.isVerified = true;
                await user.save({ session });
            }
            await session.commitTransaction();
            return done(null, user);
        }

        const newUser = {
            name: profile.displayName,
            email: profile.emails[0].value,
            avatar: profile.photos[0].value,
            role: 'customer', 
            googleAuth: {
                googleId: profile.id,
                isVerified: true
            },
            isEmailVerified: true
        };

        const [createdUser] = await User.create([newUser], { session });

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