import { Icons } from "@/components/Icons";

export default function Stars({
  value,
  onChange,
  size = 26,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= value;
        return (
          <span key={i} onClick={() => onChange?.(i)} style={{ cursor: onChange ? "pointer" : "default", lineHeight: 1, display: "flex" }}>
            <Icons.star s={size} c={filled ? "var(--gold)" : "var(--hair)"} f={filled ? "var(--gold)" : "none"} />
          </span>
        );
      })}
    </div>
  );
}
