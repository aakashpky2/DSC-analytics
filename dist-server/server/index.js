"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const next_1 = __importDefault(require("next"));
const api_1 = require("./routes/api");
const auth_1 = require("./auth");
const supabase_1 = require("./supabase");
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
// Initialize Next.js app with SSR
const nextApp = (0, next_1.default)({ dev, hostname, port });
const handle = nextApp.getRequestHandler();
// Public frontend routes and static assets that do not require authentication
const PUBLIC_PAGE_PREFIXES = [
    '/login',
    '/forgot-password',
    '/reset-password',
    '/_next',
    '/favicon.ico',
    '/favicon.png',
    '/icon.png',
    '/apple-icon.png',
    '/signsync-logo.png',
    '/logo.png',
    '/next.svg',
    '/vercel.svg',
];
async function startServer() {
    await nextApp.prepare();
    // Ensure sessions and password reset tables exist
    await (0, supabase_1.run)(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    await (0, supabase_1.run)(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    const server = (0, express_1.default)();
    server.use((0, cookie_parser_1.default)());
    server.use(express_1.default.json({ limit: '25mb' }));
    server.use(express_1.default.urlencoded({ extended: true, limit: '25mb' }));
    // Backend API endpoints mounted on /api
    server.use('/api', api_1.apiRouter);
    // SSR Page Level Authentication Guard:
    // Protect all commercial business pages. Unauthenticated users are redirected to /login.
    server.use(async (req, res, nextRoute) => {
        var _a, _b;
        const urlPath = req.path;
        // Allow Next.js internal static assets and public auth pages
        const isPublic = PUBLIC_PAGE_PREFIXES.some((prefix) => urlPath.startsWith(prefix));
        if (isPublic) {
            // If user is already authenticated and visits /login, redirect to /
            if (urlPath === '/login') {
                const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[auth_1.SESSION_COOKIE_NAME];
                if (token) {
                    const user = await (0, auth_1.validateSessionToken)(token);
                    if (user) {
                        if (user.password_change_required) {
                            return res.redirect('/change-password');
                        }
                        return res.redirect('/');
                    }
                }
            }
            return nextRoute();
        }
        // Check for valid session cookie
        const token = (_b = req.cookies) === null || _b === void 0 ? void 0 : _b[auth_1.SESSION_COOKIE_NAME];
        if (!token) {
            return res.redirect('/login');
        }
        const user = await (0, auth_1.validateSessionToken)(token);
        if (!user) {
            // Invalidate expired/bad cookie and redirect to login
            res.clearCookie(auth_1.SESSION_COOKIE_NAME);
            return res.redirect('/login');
        }
        // Mandatory first-login password change check
        if (user.password_change_required) {
            if (urlPath !== '/change-password') {
                return res.redirect('/change-password');
            }
        }
        else if (urlPath === '/change-password') {
            return res.redirect('/');
        }
        // Set cache prevention headers on protected responses
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        req.user = user;
        return nextRoute();
    });
    // Next.js handles page rendering via Server-Side Rendering (SSR)
    server.all('{*path}', (req, res) => {
        return handle(req, res);
    });
    server.listen(port, () => {
        console.log(`> [SignSync B2B] Server running on http://${hostname}:${port}`);
        console.log(`> Backend API mounted at /api/* with strict RBAC & session verification`);
        console.log(`> Next.js SSR protected by server-side authentication guard`);
    });
}
startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
