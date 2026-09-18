import { getTools } from "@/lib/notion";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const res = await getTools();

    return new Response(JSON.stringify(res), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // The read is either a full listing or a failure: an empty array is a successful
    // read of nothing, and a transport failure is a 500, never a 404.
    console.error("Error processing request:", error);
    return new Response(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
};
