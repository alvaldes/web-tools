import { getTags } from "@/lib/notion";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const res = await getTags();

    return new Response(JSON.stringify(res), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // Without this the Notion failure escaped as an uncontrolled 500 with no log, so the
    // client's "no results" was indistinguishable from a broken catalog.
    console.error("Error processing request:", error);
    return new Response(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
};
