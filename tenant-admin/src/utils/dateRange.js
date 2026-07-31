// toISOString() converts to the UTC calendar date, not the local one - for
// IST (UTC+5:30, the timezone implied everywhere else in this app), any
// time before 5:30am local is still "yesterday" in UTC, which silently
// shifted date-range boundaries back by one. Built from local date
// components instead, matching orderStatusUtils.isToday's approach.
export const toDateInputValue = (date) => {

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;

};

export const defaultDateRange = (days) => {

    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    return { from: toDateInputValue(fromDate), to: toDateInputValue(toDate) };

};
