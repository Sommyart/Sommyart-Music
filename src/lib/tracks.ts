export interface Track {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string;
  uploadedAt?: string;
  category?: string;
}

// Static fallback tracks — sorted alphabetically by title
export const tracks: Track[] = [
  { id: "2", title: "Anointed", artist: "Sommyart", audioUrl: "/music/Anointed.mp3", coverUrl: "/images/logo.png" },
  { id: "3", title: "Better Days Ahead", artist: "Sommyart", audioUrl: "/music/Better_Days_Ahead.mp3", coverUrl: "/images/logo.png" },
  { id: "33", title: "Brilliance in the Pit", artist: "Sommyart", audioUrl: "/music/Brilliance_in_the_Pit_Track_9.mp3", coverUrl: "/images/logo.png" },
  { id: "4", title: "Chinaza Ekpere", artist: "Sommyart", audioUrl: "/music/Chinaza_Ekpere.mp3", coverUrl: "/images/logo.png" },
  { id: "5", title: "Chukwubuikem", artist: "Sommyart", audioUrl: "/music/Chukwubuikem.mp3", coverUrl: "/images/logo.png" },
  { id: "6", title: "Clock It", artist: "Sommyart", audioUrl: "/music/Clock_It.mp3", coverUrl: "/images/logo.png" },
  { id: "7", title: "Consecrated", artist: "Sommyart", audioUrl: "/music/Consecrated.mp3", coverUrl: "/images/logo.png" },
  { id: "32", title: "Desert Prayer", artist: "Sommyart", audioUrl: "/music/Desert_Prayer_Track_8.mp3", coverUrl: "/images/logo.png" },
  { id: "8", title: "Do Good Oo", artist: "Sommyart", audioUrl: "/music/Do_Good_Oo.mp3", coverUrl: "/images/logo.png" },
  { id: "10", title: "Do Good Oo (Remix)", artist: "Sommyart", audioUrl: "/music/Do_Good_Oo_2.mp3", coverUrl: "/images/logo.png" },
  { id: "13", title: "Gratitude (R&B Remix)", artist: "Sommyart", audioUrl: "/music/Gratitude_RnB_Remix.mp3", coverUrl: "/images/logo.png" },
  { id: "12", title: "Grind No Stop", artist: "Sommyart", audioUrl: "/music/Grind_No_Stop.mp3", coverUrl: "/images/logo.png" },
  { id: "27", title: "Guitar Fireworks", artist: "Sommyart", audioUrl: "/music/Guitar_Fireworks.mp3", coverUrl: "/images/logo.png" },
  { id: "28", title: "Guitar Fireworks (Remix)", artist: "Sommyart", audioUrl: "/music/Guitar_Fireworks_1.mp3", coverUrl: "/images/logo.png" },
  { id: "34", title: "Guitar Fireworks (Remix 2)", artist: "Sommyart", audioUrl: "/music/Guitar_Fireworks_2.mp3", coverUrl: "/images/logo.png" },
  { id: "9", title: "Jehovah Emekwala Ya Ozo", artist: "Sommyart", audioUrl: "/music/Jehovah_Emekwala_Ya_Ozo.mp3", coverUrl: "/images/logo.png" },
  { id: "11", title: "Jehovah Ibu Eze", artist: "Sommyart", audioUrl: "/music/Jehovah_Ibu_Eze.mp3", coverUrl: "/images/logo.png" },
  { id: "14", title: "Jejeli for You", artist: "Sommyart", audioUrl: "/music/Jejeli_for_You.mp3", coverUrl: "/images/logo.png" },
  { id: "15", title: "No Easy Road", artist: "Sommyart", audioUrl: "/music/No_Easy_Road.mp3", coverUrl: "/images/logo.png" },
  { id: "24", title: "Number One Cool Bliss", artist: "Sommyart", audioUrl: "/music/Number_One_Cool_Bliss.mp3", coverUrl: "/images/logo.png" },
  { id: "17", title: "Oil Dey My Head", artist: "Sommyart", audioUrl: "/music/Oil_Dey_My_Head.mp3", coverUrl: "/images/logo.png" },
  { id: "25", title: "Omalicha Nwa", artist: "Sommyart", audioUrl: "/music/Omalicha_Nwa.mp3", coverUrl: "/images/logo.png" },
  { id: "31", title: "On My Knees", artist: "Sommyart", audioUrl: "/music/ON_MY_KNEES_Track_5.mp3", coverUrl: "/images/logo.png" },
  { id: "16", title: "Ose Oluwa Baba Mimo", artist: "Sommyart", audioUrl: "/music/Ose_Oluwa_Baba_Mimo.mp3", coverUrl: "/images/logo.png" },
  { id: "18", title: "Overflow", artist: "Sommyart", audioUrl: "/music/Overflow.mp3", coverUrl: "/images/logo.png" },
  { id: "19", title: "Patience & Prayers", artist: "Sommyart", audioUrl: "/music/Patience_Prayers.mp3", coverUrl: "/images/logo.png" },
  { id: "26", title: "Princess Keisha", artist: "Sommyart", audioUrl: "/music/Princess_Keisha.mp3", coverUrl: "/images/logo.png" },
  { id: "20", title: "Slippery", artist: "Sommyart", audioUrl: "/music/Slippery.mp3", coverUrl: "/images/logo.png" },
  { id: "21", title: "Soul in the Trap", artist: "Sommyart", audioUrl: "/music/Soul_in_the_Trap.mp3", coverUrl: "/images/logo.png" },
  { id: "29", title: "Sparking Vibes", artist: "Sommyart", audioUrl: "/music/Sparking_Vibes.mp3", coverUrl: "/images/logo.png" },
  { id: "30", title: "Sparking Vibes (Remix)", artist: "Sommyart", audioUrl: "/music/Sparking_Vibes_1.mp3", coverUrl: "/images/logo.png" },
  { id: "22", title: "Survival Instinct", artist: "Sommyart", audioUrl: "/music/Survival_Instinct.mp3", coverUrl: "/images/logo.png" },
  { id: "23", title: "The Colors of the Cove", artist: "Sommyart", audioUrl: "/music/The_Colors_of_the_Cove.mp3", coverUrl: "/images/logo.png" },
  { id: "1", title: "Tu Es Belle Chi Baby", artist: "Sommyart", audioUrl: "/music/Tu_Es_Belle_Chi_Baby.mp3", coverUrl: "/images/logo.png" },
  { id: "35", title: "Ịhụnanya m (My Love)", artist: "Sommyart", audioUrl: "/music/Ihunanya_m_My_Love_v2.mp3", coverUrl: "/images/logo.png" },
  { id: "36", title: "Ita Kaɗai (My Baby Girl)", artist: "Sommyart", audioUrl: "/music/Ita_Kadai_My_Baby_Girl.mp3", coverUrl: "/images/logo.png" },
  { id: "37", title: "Na ɓace (Lost in You)", artist: "Sommyart", audioUrl: "/music/Na_bace_Lost_in_You.m4a", coverUrl: "/images/logo.png" },
];

// Kosher Music tracks — sorted alphabetically
export const kosherTracks: Track[] = [
  { id: "k1", title: "Adonai Echad (The One)", artist: "Sommyart", audioUrl: "/music/Adonai_Echad_The_One.mp3", coverUrl: "/images/logo.png", category: "kosher" },
  { id: "k2", title: "Baruch Hashem Adonai", artist: "Sommyart", audioUrl: "/music/Baruch_Hashem_Adonai_Afro-Hebrew_Worship.mp3", coverUrl: "/images/logo.png", category: "kosher" },
  { id: "k3", title: "Kadosh Adonai (Weight of Glory)", artist: "Sommyart", audioUrl: "/music/Kadosh_Adonai_Weight_of_Glory.mp3", coverUrl: "/images/logo.png", category: "kosher" },
  { id: "k4", title: "Return to Hashem", artist: "Sommyart", audioUrl: "/music/Return_to_Hashem_Track_3.mp3", coverUrl: "/images/logo.png", category: "kosher" },
  { id: "k5", title: "Shabbat Shalom (Sacred Stillness)", artist: "Sommyart", audioUrl: "/music/Shabbat_Shalom_Sacred_Stillness.mp3", coverUrl: "/images/logo.png", category: "kosher" },
];
