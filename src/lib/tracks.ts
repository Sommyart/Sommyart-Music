export interface Track {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string;
}

export const tracks: Track[] = [
  {
    id: "1",
    title: "Guitar Fireworks",
    artist: "Sommyart",
    audioUrl: "/music/Guitar_Fireworks.mp3",
    coverUrl: "/images/logo.png",
  },
  {
    id: "2",
    title: "Guitar Fireworks (Remix)",
    artist: "Sommyart",
    audioUrl: "/music/Guitar_Fireworks_1.mp3",
    coverUrl: "/images/logo.png",
  },
  {
    id: "3",
    title: "Sparking Vibes",
    artist: "Sommyart",
    audioUrl: "/music/Sparking_Vibes.mp3",
    coverUrl: "/images/logo.png",
  },
  {
    id: "4",
    title: "Sparking Vibes (Remix)",
    artist: "Sommyart",
    audioUrl: "/music/Sparking_Vibes_1.mp3",
    coverUrl: "/images/logo.png",
  },
  {
    id: "5",
    title: "On My Knees",
    artist: "Sommyart",
    audioUrl: "/music/ON_MY_KNEES_Track_5.mp3",
    coverUrl: "/images/logo.png",
  },
  {
    id: "6",
    title: "Desert Prayer",
    artist: "Sommyart",
    audioUrl: "/music/Desert_Prayer_Track_8.mp3",
    coverUrl: "/images/logo.png",
  },
  {
    id: "7",
    title: "Brilliance in the Pit",
    artist: "Sommyart",
    audioUrl: "/music/Brilliance_in_the_Pit_Track_9.mp3",
    coverUrl: "/images/logo.png",
  },
];
