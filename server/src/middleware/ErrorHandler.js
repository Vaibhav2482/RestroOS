import { errorResponse } from "../utils/ApiResponse.js";

const errorHandler = (err, req, res, next) => {

    console.error(err);

    const statusCode = err.statusCode || 500;

    const message = statusCode === 500 && process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message || "Internal Server Error";

    return errorResponse(
        res,
        message,
        statusCode
    );

};

export default errorHandler;
