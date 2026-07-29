import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchSongsTool from "./tools/search-songs";
import listFavouritesTool from "./tools/list-favourites";
import addFavouriteTool from "./tools/add-favourite";
import removeFavouriteTool from "./tools/remove-favourite";
import recentlyPlayedTool from "./tools/recently-played";
import getPlaybackStateTool from "./tools/get-playback-state";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "holo-music-stream",
  title: "Holo Music Stream",
  version: "0.1.0",
  instructions:
    "Tools for Holo Music Stream. Search the catalog, manage the signed-in user's favourites, and read their recently played tracks and playback state.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchSongsTool,
    listFavouritesTool,
    addFavouriteTool,
    removeFavouriteTool,
    recentlyPlayedTool,
    getPlaybackStateTool,
  ],
});
