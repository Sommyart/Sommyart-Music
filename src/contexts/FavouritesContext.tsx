import { createContext, useContext, ReactNode } from "react";
import { useFavourites } from "@/hooks/useFavourites";

type FavouritesContextType = ReturnType<typeof useFavourites>;

const FavouritesContext = createContext<FavouritesContextType | null>(null);

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const favourites = useFavourites();
  return (
    <FavouritesContext.Provider value={favourites}>
      {children}
    </FavouritesContext.Provider>
  );
}

export function useFavouritesContext() {
  const ctx = useContext(FavouritesContext);
  if (!ctx) throw new Error("useFavouritesContext must be inside FavouritesProvider");
  return ctx;
}
