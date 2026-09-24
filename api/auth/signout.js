const { handleAuthSignOut } = require('../../lib/auth-api');

module.exports = async (req, res) => {
  await handleAuthSignOut(req, res);
};
