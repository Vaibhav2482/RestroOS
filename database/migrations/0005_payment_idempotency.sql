-- Backstop against a duplicate Razorpay callback inserting two Payments
-- rows for the same transaction (FRS A5) - application code also checks
-- for an existing row before inserting, this is the database-level
-- guarantee for the race between that check and the insert. Partial so it
-- doesn't reject the many NULL TransactionIds (Cash payments).
CREATE UNIQUE INDEX "UQ_Payments_TransactionId" ON "Payments" ("TransactionId") WHERE "TransactionId" IS NOT NULL;
