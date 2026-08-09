import { errorResponse } from "../utils/ApiResponse.js";
import { captureException } from "../config/sentry.js";

const errorHandler = (err, req, res, next) => {

    console.error(err);

    // A handful of create flows (registration, admin/coupon/table/category
    // creation) do a SELECT existence check then a separate INSERT with no
    // transaction between them - under a concurrent duplicate submission
    // (e.g. a double-clicked submit) the check can pass for both requests
    // before either INSERT lands, so the second INSERT hits the DB
    // constraint instead. Without this, that surfaced as a raw/generic 500
    // instead of the same clean "already exists" message the first request
    // would have gotten from its own check.
    if (err.code === "23505") {
        return errorResponse(res, "That already exists - check for a duplicate.", 409);
    }

    if (err.code === "23503") {
        return errorResponse(res, "That action references something that no longer exists.", 400);
    }

    const statusCode = err.statusCode || 500;

    // Only genuine, unexpected 500s - the 23505/23503 cases above and any
    // err.statusCode already in the 400s are expected, user-facing outcomes
    // (a duplicate, a bad reference, a validation failure), not bugs worth
    // paging anyone over.
    if (statusCode >= 500) {
        captureException(err);
    }

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
