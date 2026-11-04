"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env.local' });
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const next_1 = __importDefault(require("next"));
const api_1 = require("./routes/api");
const db_1 = require("./db");
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
// Initialize Next.js app with SSR
const nextApp = (0, next_1.default)({ dev, hostname, port });
const handle = nextApp.getRequestHandler();
async function startServer() {
    // Initialize Database tables and seeds
    await (0, db_1.initDatabase)();
    await nextApp.prepare();
    const server = (0, express_1.default)();
    server.use((0, cors_1.default)());
    server.use(express_1.default.json({ limit: '10mb' }));
    server.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // Backend API endpoints mounted on /api
    server.use('/api', api_1.apiRouter);
    // Next.js handles all other page rendering via Server-Side Rendering (SSR)
    server.all('*', (req, res) => {
        return handle(req, res);
    });
    server.listen(port, () => {
        console.log(`> [DSC Analytics] Server running on http://${hostname}:${port}`);
        console.log(`> Backend API routes mounted at /api/*`);
        console.log(`> Next.js SSR frontend handling all user interfaces`);
    });
}
startServer().catch((err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
});
