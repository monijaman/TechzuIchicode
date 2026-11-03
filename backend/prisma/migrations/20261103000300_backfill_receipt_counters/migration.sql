-- Every outlet has one counter row so receipt increments can lock one stable
-- record and remain sequential under concurrent sales.
INSERT INTO "ReceiptCounter" ("outletId", "lastIssued", "updatedAt")
SELECT "id", 0, CURRENT_TIMESTAMP
FROM "Outlet"
ON CONFLICT ("outletId") DO NOTHING;
