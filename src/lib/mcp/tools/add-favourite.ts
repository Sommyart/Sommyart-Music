import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "add_favourite",
  title: "Add favourite",
  description: "Add a song to the signed-in user's favourites.",
  inputSchema: {
    song_id: z.string().uuid().describe("The song's UUID."),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ song_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("favourites")
      .insert({ user_id: ctx.getUserId(), song_id })
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Added favourite ${song_id}` }],
      structuredContent: { favourite: data },
    };
  },
});
