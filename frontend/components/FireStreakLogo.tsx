"use client";

type FireStreakLogoProps = {
  size?: "nav" | "sm" | "md" | "lg" | "hero";
  className?: string;
  label?: string;
};

export default function FireStreakLogo({
  size = "md",
  className = "",
  label = "Application streak fire logo",
}: FireStreakLogoProps) {
  return (
    <div className={`fire-logo fire-logo-${size} ${className}`.trim()} role="img" aria-label={label}>
      <div className="fire-logo-video">
        <span className="fire-streak fire-streak-one" />
        <span className="fire-streak fire-streak-two" />
        <span className="fire-streak fire-streak-three" />
        <span className="fire-glow" />
        <span className="fire-flame fire-flame-back" />
        <span className="fire-flame fire-flame-main" />
        <span className="fire-flame fire-flame-core" />
        <span className="fire-ember fire-ember-one" />
        <span className="fire-ember fire-ember-two" />
        <span className="fire-ember fire-ember-three" />
        <span className="fire-ember fire-ember-four" />
      </div>
    </div>
  );
}
