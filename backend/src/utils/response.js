export const success = (response, data, statusCode = 200) => response.status(statusCode).json({ success: true, data });

export const failure = (response, message, code = 'ERROR', statusCode = 500, details) => response.status(statusCode).json({ success: false, message, code, ...(details ? { details } : {}) });
