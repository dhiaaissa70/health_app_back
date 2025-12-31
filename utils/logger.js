// Logging utility

const logger = {
    info: (...args) => {
        console.log(`ℹ️  [INFO] ${new Date().toISOString()} - ${args.join(' ')}`);
    },

    error: (...args) => {
        console.error(`❌ [ERROR] ${new Date().toISOString()} - ${args.join(' ')}`);
    },

    warn: (...args) => {
        console.warn(`⚠️  [WARN] ${new Date().toISOString()} - ${args.join(' ')}`);
    },

    success: (...args) => {
        console.log(`✅ [SUCCESS] ${new Date().toISOString()} - ${args.join(' ')}`);
    }
};

module.exports = logger;
