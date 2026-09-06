// Small line-style category icons for the store/inventory/build filter
// bars. Hand-drawn, not pulled from an icon library — keeps the bundle
// free of an external dependency for eight tiny glyphs. All share the
// same stroke conventions (currentColor, round caps/joins) so they read as
// one family and pick up a button's text color automatically.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Base(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function FuelIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="4" width="9" height="17" rx="1.5" />
      <path d="M9 1.5h1.5M14 8l3 2.5v7a1.7 1.7 0 0 0 3.4 0v-4.5L18 10.5" />
      <path d="M8 9h3" />
    </Base>
  );
}

export function CargoIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 7.5 12 3l8.5 4.5L12 12 3.5 7.5Z" />
      <path d="M3.5 7.5V16l8.5 4.5V12M20.5 7.5V16L12 20.5" />
    </Base>
  );
}

export function ArmourIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 2.5 19 5.5v5c0 5-3 8.6-7 10.5-4-1.9-7-5.5-7-10.5v-5L12 2.5Z" />
    </Base>
  );
}

export function DriveIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 5v2.5M12 16.5V19M5 12h2.5M16.5 12H19M7.5 7.5l1.7 1.7M14.8 14.8l1.7 1.7M16.5 7.5l-1.7 1.7M9.2 14.8l-1.7 1.7" />
    </Base>
  );
}

export function SteerIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M12 13.6V21M6.2 8.5l4.9 2.8M17.8 8.5l-4.9 2.8" />
    </Base>
  );
}

export function SensorIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 12a8 8 0 0 1 16 0" />
      <path d="M7.2 12a4.8 4.8 0 0 1 9.6 0" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <path d="M12 12 3 20" />
    </Base>
  );
}

export function AnalyserIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 21 21" />
      <path d="M8 10.5h5M10.5 8v5" />
    </Base>
  );
}

export function ExpansionIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </Base>
  );
}

export function FullBuildIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </Base>
  );
}

export function DefaultIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="7" />
    </Base>
  );
}

const ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  fuel: FuelIcon,
  cargo: CargoIcon,
  armour: ArmourIcon,
  drive: DriveIcon,
  steer: SteerIcon,
  sensor: SensorIcon,
  analyser: AnalyserIcon,
  expansion: ExpansionIcon,
};

export function categoryIcon(category: string): (props: IconProps) => React.JSX.Element {
  return ICONS[category] ?? DefaultIcon;
}
