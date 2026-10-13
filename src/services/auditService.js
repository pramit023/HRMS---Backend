const AuditLog = require('../models/AuditLog');

const logAudit = async ({ req, user, action, module, details }) => {
  try {
    const actorUser = user || (req && req.user);
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '') : '';
    const userAgent = req ? (req.headers['user-agent'] || '') : '';

    await AuditLog.create({
      user: actorUser ? actorUser._id : null,
      userName: actorUser ? actorUser.name : 'System',
      userRole: actorUser ? actorUser.role : 'System',
      action,
      module,
      details,
      ipAddress: ip,
      userAgent,
    });
  } catch (error) {
    console.error('[Audit Log Error]', error.message);
  }
};

module.exports = {
  logAudit,
};
