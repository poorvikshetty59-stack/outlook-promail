"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const ioredis_1 = __importDefault(require("ioredis"));
const zod_1 = require("zod");
const config_js_1 = require("./config.js");
const db_js_1 = require("./db.js");
const routes_js_1 = require("./routes.js");
require("./worker.js");
const healthRedis = new ioredis_1.default(config_js_1.config.redisUrl, {
    connectTimeout: 5000,
    maxRetriesPerRequest: 1
});
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: config_js_1.config.frontendUrl,
    credentials: true
}));
app.use(express_1.default.json({ limit: '2mb' }));
app.use((0, cookie_parser_1.default)());
app.use('/api', routes_js_1.router);
app.get('/health', async (_request, response) => {
    const [postgresResult, redisResult] = await Promise.allSettled([
        db_js_1.prisma.$queryRaw `SELECT 1`,
        healthRedis.ping()
    ]);
    const postgres = postgresResult.status === 'fulfilled' ? 'connected' : 'unavailable';
    const redis = redisResult.status === 'fulfilled' ? 'connected' : 'unavailable';
    if (postgresResult.status === 'rejected')
        console.error('PostgreSQL health check failed', postgresResult.reason);
    if (redisResult.status === 'rejected')
        console.error('Redis health check failed', redisResult.reason);
    response.status(postgres === 'connected' && redis === 'connected' ? 200 : 503).json({
        ok: postgres === 'connected' && redis === 'connected',
        postgres,
        redis
    });
});
app.use((error, _request, response, _next) => {
    console.error('API request failed', error);
    if (response.headersSent)
        return;
    if (error instanceof zod_1.z.ZodError) {
        return response.status(400).json({
            error: error.issues[0]?.message ??
                'Invalid request'
        });
    }
    response.status(500).json({
        error: 'The server could not complete the request'
    });
});
app.listen(config_js_1.config.port, '0.0.0.0', () => {
    console.log(`API listening on port ${config_js_1.config.port}`);
});
