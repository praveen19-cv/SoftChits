"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const setup_1 = require("./database/setup");
const members_1 = __importDefault(require("./routes/members"));
const groups_1 = __importDefault(require("./routes/groups"));
const collections_1 = __importDefault(require("./routes/collections"));
const auth_1 = __importDefault(require("./routes/auth"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Database setup
(0, setup_1.setupDatabase)();
// Routes
app.use('/api/members', members_1.default);
app.use('/api/groups', groups_1.default);
app.use('/api/collections', collections_1.default);
app.use('/api/auth', auth_1.default);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
