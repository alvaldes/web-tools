import { getTools } from "@/lib/notion";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const res = await getTools();

    if (!res) {
      return new Response(null, {
        status: 404,
        statusText: "Not found",
      });
    }

    return new Response(JSON.stringify(res), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
};
