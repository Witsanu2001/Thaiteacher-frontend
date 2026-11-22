import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../src/shared/funtion/schoolInvitationLink.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const helpers = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const token = Buffer.alloc(32, 5).toString("base64url");
function storage() {
 const values = new Map();
 return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
test("invitation URL keeps secret in fragment, not path or query", () => {
 const link = new URL(helpers.schoolInvitationLink(token, "https://thaiteacher-app.web.app"));
 assert.equal(link.pathname, "/invite"); assert.equal(link.search, "");
 assert.equal(new URLSearchParams(link.hash.slice(1)).get("token"), token);
 assert.equal(link.origin, "https://thaiteacher-app.web.app");
});
test("reject malformed codes before generating links", () => {
 for (const value of ["", "../../users", "x".repeat(44), "x?foo=bar", "x".repeat(42) + "/"]) assert.throws(() => helpers.schoolInvitationLink(value, "https://example.com"));
});
test("OAuth same-tab return resumes the stored invitation", () => {
 const saved = storage();
 assert.equal(helpers.pendingSchoolInvitation("#token=" + token, saved, 100), token);
 assert.equal(helpers.rememberSchoolInvitation(token, saved, 100), true);
 assert.equal(helpers.pendingSchoolInvitation("", saved, 200), token);
});
test("old pending sessions expire and cannot resurrect after reload", () => {
 const saved = storage(); helpers.rememberSchoolInvitation(token, saved, 100);
 assert.equal(helpers.pendingSchoolInvitation("", saved, 100 + 60 * 60 * 1000), "");
 assert.equal(helpers.pendingSchoolInvitation("", saved, 200), "");
});
test("invalid incoming fragment never silently uses a different pending invite", () => {
 const saved = storage(); helpers.rememberSchoolInvitation(token, saved, 100);
 assert.equal(helpers.pendingSchoolInvitation("#token=bad", saved, 200), "");
 assert.equal(helpers.pendingSchoolInvitation("", saved, 200), "");
});
test("successful acceptance clears pending invitation", () => {
 const saved = storage(); helpers.rememberSchoolInvitation(token, saved, 100); helpers.forgetSchoolInvitation(saved);
 assert.equal(helpers.pendingSchoolInvitation("", saved, 200), "");
});
test("blocked storage does not cause an uncaught exception", () => {
 const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
 assert.equal(helpers.rememberSchoolInvitation(token, blocked, 100), false);
 assert.equal(helpers.pendingSchoolInvitation("", blocked, 200), "");
 assert.doesNotThrow(() => helpers.forgetSchoolInvitation(blocked));
});

const termsSource = fs.readFileSync(new URL("../src/shared/funtion/schoolInvitationTerms.ts", import.meta.url), "utf8");
const termsJS = ts.transpileModule(termsSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { validSchoolInvitationTerms } = await import("data:text/javascript;base64," + Buffer.from(termsJS).toString("base64"));
test("old or incomplete billing responses cannot render NaN as a price", () => {
 for (const value of [undefined, null, {}, { individualPriceSatang: 990 }, {billingMode: "individual"}, ...[NaN, Infinity, -1, 0, 9.9, "990"].map(price => ({ billingMode: "individual", individualPriceSatang: price }))]) assert.equal(validSchoolInvitationTerms(value), false);
});
test("valid inviter-assigned terms can be displayed without recipient selection", () => {
 assert.equal(validSchoolInvitationTerms({billingMode:"sponsored"}), true);
 assert.equal(validSchoolInvitationTerms({billingMode:"individual",individualPriceSatang:990}), true);
});
