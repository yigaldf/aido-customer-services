#!/usr/bin/env node
/* One-time setup: creates the Neon Peach tables in an Airtable base and loads the demo data.
 *
 * Usage:
 *   AIRTABLE_TOKEN=pat... AIRTABLE_BASE_ID=app... node scripts/setup-airtable.js
 *   node scripts/setup-airtable.js --seed-only   # only reload demo data (tables already exist)
 *
 * The token needs these scopes: data.records:read, data.records:write,
 * schema.bases:read, schema.bases:write.
 */
"use strict";
const path = require("path");

global.window = globalThis;
require(path.join(__dirname, "..", "data.js"));
require(path.join(__dirname, "..", "config.js"));
const AT = require(path.join(__dirname, "..", "airtable.js"));

const token = process.env.AIRTABLE_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID || window.NP_CONFIG.baseId;
if (!token) { console.error("Missing AIRTABLE_TOKEN"); process.exit(1); }

const dict = window.NP_DICT;
const choices = (d) => ({ choices: Object.values(d).map((v) => ({ name: v.label, color: v.at })) });
const dateTime = { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "Asia/Jerusalem" };

const SCHEMA = [
  {
    name: AT.TABLES.agents, description: "Neon Peach — נציגי שירות",
    fields: [
      { name: "Name", type: "singleLineText" },
      { name: "Role", type: "singleLineText" },
      { name: "Avatar", type: "singleLineText" },
    ],
  },
  {
    name: AT.TABLES.tickets, description: "Neon Peach — פניות לקוחות",
    fields: [
      { name: "TicketId", type: "singleLineText" },
      { name: "CreatedAt", type: "dateTime", options: dateTime },
      { name: "CustomerName", type: "singleLineText" },
      { name: "Phone", type: "phoneNumber" },
      { name: "Channel", type: "singleSelect", options: choices(dict.channels) },
      { name: "Category", type: "singleSelect", options: choices(dict.categories) },
      { name: "Subject", type: "singleLineText" },
      { name: "Message", type: "multilineText" },
      { name: "Priority", type: "singleSelect", options: choices(dict.priorities) },
      { name: "Status", type: "singleSelect", options: choices(dict.statuses) },
      { name: "Assignee", type: "singleLineText" },
      { name: "ReservationDate", type: "date", options: { dateFormat: { name: "iso" } } },
      { name: "ReservationTime", type: "singleLineText" },
      { name: "Guests", type: "number", options: { precision: 0 } },
      { name: "Rating", type: "number", options: { precision: 0 } },
    ],
  },
  {
    name: AT.TABLES.notes, description: "Neon Peach — הערות פנימיות לפניות",
    fields: [
      { name: "Text", type: "multilineText" },
      { name: "Ticket", type: "multipleRecordLinks", options: { linkedTableId: "__TICKETS__" } },
      { name: "Author", type: "singleLineText" },
      { name: "At", type: "dateTime", options: dateTime },
    ],
  },
];

(async () => {
  const client = AT.createClient({ baseId, token });
  const seedOnly = process.argv.includes("--seed-only");

  if (!seedOnly) {
    const { tables } = await client.request("GET", `meta/bases/${baseId}/tables`);
    const ids = Object.fromEntries(tables.map((t) => [t.name, t.id]));
    for (const table of SCHEMA) {
      if (ids[table.name]) { console.log(`✓ table "${table.name}" already exists`); continue; }
      const fields = table.fields.map((f) =>
        f.options?.linkedTableId === "__TICKETS__" ? { ...f, options: { linkedTableId: ids[AT.TABLES.tickets] } } : f);
      const created = await client.request("POST", `meta/bases/${baseId}/tables`, { name: table.name, description: table.description, fields });
      ids[table.name] = created.id;
      console.log(`+ created table "${table.name}" (${created.id})`);
    }
  }

  const result = await AT.seedDemo(client, { tickets: window.npBuildTickets(), agents: window.NP_AGENTS, dict }, (m) => console.log("  " + m));
  console.log(`✓ demo data loaded: ${result.tickets} tickets, ${result.notes} notes, ${result.agents} agents`);
})().catch((e) => { console.error("✗", e.message); process.exit(1); });
