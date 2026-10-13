let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    // console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('join', ({ userId, role }) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
      if (role) {
        socket.join(`role_${role}`);
      }
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  return ioInstance;
};

const getIO = () => {
  return ioInstance;
};

const sendRealtimeNotification = (notification) => {
  if (!ioInstance) return;

  if (notification.recipient) {
    ioInstance.to(`user_${notification.recipient}`).emit('notification', notification);
  } else if (notification.targetRole && notification.targetRole !== 'All') {
    ioInstance.to(`role_${notification.targetRole}`).emit('notification', notification);
  } else {
    ioInstance.emit('notification', notification);
  }
};

module.exports = {
  initSocket,
  getIO,
  sendRealtimeNotification,
};
