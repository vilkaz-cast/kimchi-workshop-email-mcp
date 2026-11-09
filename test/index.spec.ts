import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { EMAILS } from "../src/emails";

function jsonRpcRequest(id: number, method: string, params?: unknown) {
  return {
    jsonrpc: "2.0" as const,
    id,
    method,
    ...(params === undefined ? {} : { params }),
  };
}

function parseSseJsonRpc(text: string): { result: unknown } {
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      return JSON.parse(line.slice(6));
    }
  }
  throw new Error("no data frame in SSE response");
}

describe("workshop-email-mcp worker", () => {
  it("GET / returns 200 help text", async () => {
    const res = await SELF.fetch("https://example.com/");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("workshop-email-mcp");
    expect(text).toContain("POST /mcp");
  });

  it("MCP initialize handshake succeeds and returns serverInfo", async () => {
    const res = await SELF.fetch("https://example.com/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(
        jsonRpcRequest(1, "initialize", {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "vitest-client", version: "1.0.0" },
        }),
      ),
    });
    expect(res.status).toBe(200);
    // Optional per spec: tests must tolerate a missing mcp-session-id.
    const sessionId = res.headers.get("mcp-session-id");

    const body = parseSseJsonRpc(await res.text()) as {
      result: { serverInfo: { name: string } };
    };
    expect(body.result.serverInfo.name).toBe("workshop-email-mcp");
  });

  it("tools/call list_emails returns the 6 inbox emails with correct ids and categories", async () => {
    // Initialize first to obtain a session id.
    const initRes = await SELF.fetch("https://example.com/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(
        jsonRpcRequest(1, "initialize", {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "vitest-client", version: "1.0.0" },
        }),
      ),
    });
    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers.get("mcp-session-id");

    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }

    const callRes = await SELF.fetch("https://example.com/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify(
        jsonRpcRequest(2, "tools/call", {
          name: "list_emails",
          arguments: {},
        }),
      ),
    });
    expect(callRes.status).toBe(200);

    const body = parseSseJsonRpc(await callRes.text()) as {
      result: { content: { type: string; text: string }[] };
    };
    expect(body.result.content).toHaveLength(1);
    expect(body.result.content[0].type).toBe("text");

    const text = body.result.content[0].text;
    const emails = JSON.parse(text) as {
      id: string;
      category: string;
    }[];

    // Mirrors the embedded data; cross-checked against the module below.
    expect(emails).toHaveLength(6);
    expect(EMAILS).toHaveLength(6);
    // Welcome on top, then briefings in live inbox order.
    expect(emails.map((e) => e.id)).toEqual([
      "welcome",
      "start-here",
      "incident-brief",
      "spec-docstrings",
      "submission-lifecycle",
      "kimchi-cadence",
    ]);
    expect(EMAILS.map((e) => e.id)).toEqual(emails.map((e) => e.id));
    // Categories include both the personalized welcome and the briefings.
    const categories = new Set(emails.map((e) => e.category));
    expect(categories.has("welcome")).toBe(true);
    expect(categories.has("briefing")).toBe(true);

    // Identity sanitization: the attendee's name and handle must not leak
    // anywhere in the tool's returned JSON.
    expect(text).not.toContain("Vilius");
    expect(text).not.toContain("vilkaz");
  });
});
