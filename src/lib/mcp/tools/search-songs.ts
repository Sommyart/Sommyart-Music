import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "search_songs",
  title: "Search songs",
  description:
    "Search the Holo Music Stream catalog by title, artist, or genre. Returns up to 20 matching songs.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Text to match against title, artist, or genre."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const like = `%${query}%`;
    const { data, error } = await supabase
      .from("songs")
      .select("id,title,artist,genre,uploaded_at")
      .or(`title.ilike.${like},artist.ilike.${like},genre.ilike.${like}`)
      .order("title", { ascending: true })
      .limit(20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { songs: data ?? [] },
    };
  },
});
