console.log('Loading config...');
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  PORT: process.env.PORT || 3000
};
console.log('Config loaded, JWT_SECRET:', module.exports.JWT_SECRET);
