
const app = require('../src/server');
const connectDB = require('../src/config/db');

module.exports = async (req, res) => {
    try {
        await connectDB();
        return app(req, res);
    } catch (error) {
        console.error('[API startup error]', error.message);

        return res.status(503).json({
            success: false,
            message: 'Database connection unavailable',
        });
    }
};
