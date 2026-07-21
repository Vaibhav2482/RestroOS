import { errorResponse } from "../utils/ApiResponse.js";

const notFound = (req, res) => {
    return errorResponse(res, `Route Not Found : ${req.originalUrl}`, 404);
};

export default notFound;
