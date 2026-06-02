import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { storage } from "./storage";
import { registerSchema, loginSchema, type User } from "@shared/schema";

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Augment passport's `req.user` so route handlers get a typed user object
    // without `as` casts. Passport defines `User` as `{}` by default.
    interface User {
      id: string;
      email: string;
    }
  }
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters. Generate one with: openssl rand -hex 32",
    );
  }
  return secret;
}

export function configurePassport(): void {
  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        // Always run bcrypt.compare even when the user is missing so the
        // response time does not reveal which emails are registered.
        const hash = user?.passwordHash ?? "$2a$12$invalidsaltinvalidsaltinvaliduO5xRZGqHxV4WBOEdfqYK5j7eC";
        const ok = await bcrypt.compare(password, hash);
        if (!user || !ok) return done(null, false, { message: "Invalid credentials" });
        return done(null, { id: user.id, email: user.email });
      } catch (err) {
        return done(err as Error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      done(null, { id: user.id, email: user.email });
    } catch (err) {
      done(err as Error);
    }
  });
}

export function attachAuth(app: Express): void {
  configurePassport();

  const PgStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgStore({
        conString: process.env.DATABASE_URL,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: getSessionSecret(),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        // Allow http in dev; require https in production.
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_TTL_MS,
      },
      name: "sid",
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  registerAuthRoutes(app);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Try again later." },
});

function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", registerLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = registerSchema.parse(req.body);
      const normalized = email.toLowerCase();
      const existing = await storage.getUserByEmail(normalized);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const user = await storage.createUser({ email: normalized, passwordHash });
      req.login({ id: user.id, email: user.email }, (err) => {
        if (err) return next(err);
        res.status(201).json({ id: user.id, email: user.email });
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input", details: err.flatten() });
      }
      next(err);
    }
  });

  app.post("/api/auth/login", loginLimiter, (req: Request, res: Response, next: NextFunction) => {
    try {
      loginSchema.parse(req.body);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input", details: err.flatten() });
      }
      return next(err);
    }
    passport.authenticate("local", (err: Error | null, user: Express.User | false) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });
      // Regenerate the session id on login to prevent session fixation.
      const existingSession = req.session;
      existingSession.regenerate((regenErr) => {
        if (regenErr) return next(regenErr);
        req.login(user, (loginErr) => {
          if (loginErr) return next(loginErr);
          res.json({ id: user.id, email: user.email });
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: Request, res: Response, next: NextFunction) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie("sid");
        res.status(204).send();
      });
    });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    res.json({ id: req.user.id, email: req.user.email });
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
}
