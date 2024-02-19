import { getTags } from "@/lib/notion";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const res = await getTags();
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
};
