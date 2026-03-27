interface Props {
  isPlaying: boolean;
}

export function WaveformVisualizer({ isPlaying }: Props) {
  const bars = 24;
  return (
    <div className="flex items-end justify-center gap-[3px] h-8 px-4">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-neon-cyan/70 transition-all"
          style={{
            height: isPlaying ? undefined : "4px",
            animation: isPlaying
              ? `equalizer 0.${4 + (i % 5)}s ease-in-out ${(i * 0.05).toFixed(2)}s infinite`
              : "none",
          }}
        />
      ))}
    </div>
  );
}
