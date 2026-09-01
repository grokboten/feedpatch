#!/usr/bin/env node
import { createHmac, randomBytes } from "node:crypto";

const HOBBY = "feedpatch-hobby-demo-do-not-use-in-commerce-v1";
const nonceArg = (process.argv[2] || "").trim();
const nonce = nonceArg || randomBytes(8).toString("hex");
if (!/^[A-Za-z0-9_-]+$/.test(nonce)) {
  console.error("nonce must match [A-Za-z0-9_-]+");
  process.exit(1);
}
const secret = (process.env.LICENSE_SECRET || "").trim() || HOBBY;
const sig = createHmac("sha256", secret).update("fp1:" + nonce, "utf8").digest("hex").slice(0, 20);
process.stdout.write("FP1." + nonce + "." + sig + "\n");
