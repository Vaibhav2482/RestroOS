// Static for now - no external API calls, no DB table. Zomato/Swiggy don't
// offer self-serve order APIs; both gate their POS integration programs
// behind a partner-approval process (Zomato's own portal states a 200+
// restaurant or 40,000+ orders/month threshold to even qualify). Until
// there's a real account to connect, this just gives tenant owners an
// honest "here's what's coming" answer instead of no answer at all.
const AVAILABLE_INTEGRATIONS = [
    {
        key: "zomato",
        name: "Zomato",
        description: "Receive Zomato orders directly into your Orders and Kitchen screens alongside direct orders.",
        status: "coming_soon",
        statusLabel: "Coming Soon",
        note: "Zomato's POS integration program requires 200+ restaurants or 40,000+ orders/month platform-wide to qualify - we're working toward that."
    },
    {
        key: "swiggy",
        name: "Swiggy",
        description: "Receive Swiggy orders directly into your Orders and Kitchen screens alongside direct orders.",
        status: "coming_soon",
        statusLabel: "Coming Soon",
        note: "Swiggy's partner integration program has its own eligibility requirements, which we're working toward as well."
    }
];

export const getIntegrations = async () => {
    return { success: true, message: "Integrations fetched successfully.", data: AVAILABLE_INTEGRATIONS };
};
