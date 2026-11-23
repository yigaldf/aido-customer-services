/* Neon Peach — Airtable data layer (works in the browser and in Node 18+).
 *
 * Tables (created by scripts/setup-airtable.js):
 *   Tickets: TicketId, CreatedAt, CustomerName, Phone, Channel, Category, Subject, Message,
 *            Priority, Status, Assignee, ReservationDate, ReservationTime, Guests, Seating, Rating
 *   Notes:   Text, Ticket (link to Tickets), Author, At
 *   Agents:  Name, Role, Avatar
 * Single-select values are stored as the Hebrew labels from NP_DICT (data.js).
 */
(function (root) {
  "use strict";

  const API = "https://api.airtable.com/v0";
  const TABLES = { tickets: "Tickets", notes: "Notes", agents: "Agents" };
  const MIN_GAP_MS = 220; // Airtable allows 5 requests / second per base
  const BATCH = 10;       // Airtable allows 10 records per write request

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

  function createClient({ baseId, token }) {
    let last = 0;
    let queue = Promise.resolve();

    // Serialize requests and keep them under the rate limit.
    function request(method, path, body) {
      const run = async () => {
        for (let attempt = 0; ; attempt++) {
          const wait = last + MIN_GAP_MS - Date.now();
          if (wait > 0) await sleep(wait);
          last = Date.now();
          const res = await fetch(`${API}/${path}`, {
            method,
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
          });
          if (res.status === 429 && attempt < 3) { await sleep(1500 * (attempt + 1)); continue; }
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            const msg = data?.error?.message || data?.error?.type || data?.error || res.statusText;
            const err = new Error(`Airtable ${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
            err.status = res.status;
            throw err;
          }
          return data;
        }
      };
      const p = queue.then(run, run);
      queue = p.catch(() => {});
      return p;
    }

    const t = (name) => `${baseId}/${encodeURIComponent(name)}`;

    return {
      request,
      async listAll(table) {
        const out = [];
        let offset;
        do {
          const q = new URLSearchParams({ pageSize: "100" });
          if (offset) q.set("offset", offset);
          const data = await request("GET", `${t(table)}?${q}`);
          out.push(...data.records);
          offset = data.offset;
        } while (offset);
        return out;
      },
      async create(table, fieldsList) {
        const out = [];
        for (const part of chunks(fieldsList, BATCH)) {
          const data = await request("POST", t(table), { records: part.map((fields) => ({ fields })), typecast: true });
          out.push(...data.records);
        }
        return out;
      },
      async update(table, updates) {
        const out = [];
        for (const part of chunks(updates, BATCH)) {
          const data = await request("PATCH", t(table), { records: part, typecast: true });
          out.push(...data.records);
        }
        return out;
      },
      async remove(table, ids) {
        for (const part of chunks(ids, BATCH)) {
          const q = part.map((id) => `records[]=${encodeURIComponent(id)}`).join("&");
          await request("DELETE", `${t(table)}?${q}`);
        }
      },
      async ping() {
        await request("GET", `${t(TABLES.tickets)}?pageSize=1`);
        return true;
      },
    };
  }

  // ---------- Mapping between app objects and Airtable fields ----------
  const byLabel = (dict, label, fallback) => Object.keys(dict).find((k) => dict[k].label === label) || fallback;

  function ticketToFields(tk, dict) {
    const f = {
      TicketId: tk.id,
      CreatedAt: tk.createdAt,
      CustomerName: tk.customer.name,
      Phone: tk.customer.phone,
      Channel: dict.channels[tk.channel].label,
      Category: dict.categories[tk.category].label,
      Subject: tk.subject,
      Message: tk.message,
      Priority: dict.priorities[tk.priority].label,
      Status: dict.statuses[tk.status].label,
      Assignee: tk.assignee || "",
      Rating: tk.rating ?? null,
    };
    if (tk.reservation) {
      f.ReservationDate = tk.reservation.date;
      f.ReservationTime = tk.reservation.time;
      f.Guests = tk.reservation.guests;
      f.Seating = dict.seating[tk.reservation.seating || "inside"].label;
    }
    return f;
  }

  // Only the fields the dashboard can edit.
  function patchToFields(patch, dict) {
    const f = {};
    if ("status" in patch) f.Status = dict.statuses[patch.status].label;
    if ("priority" in patch) f.Priority = dict.priorities[patch.priority].label;
    if ("assignee" in patch) f.Assignee = patch.assignee || "";
    if ("seating" in patch) f.Seating = dict.seating[patch.seating].label;
    return f;
  }

  function recordToTicket(rec, notes, dict) {
    const f = rec.fields;
    const tk = {
      _rid: rec.id,
      id: f.TicketId || rec.id,
      createdAt: f.CreatedAt || rec.createdTime,
      customer: { name: f.CustomerName || "", phone: f.Phone || "" },
      channel: byLabel(dict.channels, f.Channel, "website"),
      category: byLabel(dict.categories, f.Category, "question"),
      subject: f.Subject || "",
      message: f.Message || "",
      priority: byLabel(dict.priorities, f.Priority, "medium"),
      status: byLabel(dict.statuses, f.Status, "new"),
      assignee: f.Assignee || null,
      rating: f.Rating ?? null,
      notes: notes || [],
    };
    if (f.ReservationDate) {
      tk.reservation = { date: f.ReservationDate, time: f.ReservationTime || "", guests: f.Guests || 0, seating: byLabel(dict.seating, f.Seating, "inside") };
    }
    return tk;
  }

  // ---------- High-level operations ----------
  async function loadAll(client, dict) {
    const [tRecs, nRecs, aRecs] = await Promise.all([
      client.listAll(TABLES.tickets), client.listAll(TABLES.notes), client.listAll(TABLES.agents),
    ]);
    const notesBy = {};
    for (const n of nRecs) {
      const tid = (n.fields.Ticket || [])[0];
      if (!tid) continue;
      (notesBy[tid] ||= []).push({ _rid: n.id, by: n.fields.Author || "", at: n.fields.At || n.createdTime, text: n.fields.Text || "" });
    }
    Object.values(notesBy).forEach((l) => l.sort((a, b) => new Date(a.at) - new Date(b.at)));
    return {
      tickets: tRecs.map((r) => recordToTicket(r, notesBy[r.id], dict)),
      agents: aRecs.map((r) => ({ _rid: r.id, name: r.fields.Name || "", role: r.fields.Role || "", avatar: r.fields.Avatar || "🙂" }))
        .filter((a) => a.name),
    };
  }

  async function addNote(client, ticketRid, note) {
    const [rec] = await client.create(TABLES.notes, [{ Text: note.text, Ticket: [ticketRid], Author: note.by, At: note.at }]);
    return rec.id;
  }

  async function createTicket(client, tk, dict) {
    const [rec] = await client.create(TABLES.tickets, [ticketToFields(tk, dict)]);
    return rec.id;
  }

  async function updateTicket(client, ticketRid, patch, dict) {
    await client.update(TABLES.tickets, [{ id: ticketRid, fields: patchToFields(patch, dict) }]);
  }

  /** Delete everything and load the demo data again (dates relative to now). */
  async function seedDemo(client, { tickets, agents, dict }, onProgress = () => {}) {
    onProgress("מוחק נתונים קיימים…");
    for (const table of [TABLES.notes, TABLES.tickets, TABLES.agents]) {
      const ids = (await client.listAll(table)).map((r) => r.id);
      await client.remove(table, ids);
    }
    onProgress("יוצר נציגים…");
    await client.create(TABLES.agents, agents.map((a) => ({ Name: a.name, Role: a.role, Avatar: a.avatar })));
    onProgress("יוצר פניות…");
    const recs = await client.create(TABLES.tickets, tickets.map((tk) => ticketToFields(tk, dict)));
    const ridById = Object.fromEntries(recs.map((r) => [r.fields.TicketId, r.id]));
    onProgress("יוצר הערות…");
    const notes = tickets.flatMap((tk) => tk.notes.map((n) => ({ Text: n.text, Ticket: [ridById[tk.id]], Author: n.by, At: n.at })));
    await client.create(TABLES.notes, notes);
    return { tickets: recs.length, notes: notes.length, agents: agents.length };
  }

  const api = { TABLES, createClient, loadAll, addNote, createTicket, updateTicket, seedDemo, ticketToFields };
  root.NPAirtable = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
