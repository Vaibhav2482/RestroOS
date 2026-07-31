import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollIntoView at all - several pages call it
// (category scroll-spy, chip auto-centering) as a real but non-essential
// UX touch, not something any test needs to assert on, so a no-op here
// is enough to stop it throwing and failing otherwise-unrelated tests.
Element.prototype.scrollIntoView = () => {};
