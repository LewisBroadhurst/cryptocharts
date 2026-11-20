import type { ReactNode, SVGProps } from "react";

import type { DrawingKind } from "@/lib/charts/drawings";
import type { ChartStyle } from "@/lib/charts/chart-storage";

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

const Dot = ({ cx, cy }: { cx: number; cy: number }) => (
  <circle cx={cx} cy={cy} r={1.9} fill="currentColor" stroke="none" />
);

const TOOL_PATHS: Record<DrawingKind, ReactNode> = {
  trend: (
    <>
      <path d="M5 19 19 5" />
      <Dot cx={5} cy={19} />
      <Dot cx={19} cy={5} />
    </>
  ),
  ray: (
    <>
      <path d="M5 17 21 6" />
      <Dot cx={5} cy={17} />
      <Dot cx={12} cy={12.2} />
    </>
  ),
  extended: (
    <>
      <path d="M2 20 22 4" />
      <Dot cx={8} cy={15.2} />
      <Dot cx={16} cy={8.8} />
    </>
  ),
  horizontal: (
    <>
      <path d="M2 12h20" />
      <Dot cx={12} cy={12} />
    </>
  ),
  horizontalRay: (
    <>
      <path d="M7 12h15" />
      <Dot cx={7} cy={12} />
    </>
  ),
  vertical: (
    <>
      <path d="M12 2v20" />
      <Dot cx={12} cy={12} />
    </>
  ),
  rectangle: (
    <>
      <rect x={4.5} y={6.5} width={15} height={11} rx={0.5} />
      <Dot cx={4.5} cy={6.5} />
      <Dot cx={19.5} cy={17.5} />
    </>
  ),
  fib: (
    <>
      <path d="M3 5h18M3 9.5h18M3 13h18M3 19h18" />
      <path d="M5 19 19 5" strokeDasharray="2 2.5" opacity={0.7} />
    </>
  ),
  long: (
    <>
      <rect x={4} y={4} width={16} height={8} rx={0.5} opacity={0.9} />
      <rect x={4} y={12} width={16} height={5} rx={0.5} opacity={0.45} />
      <path d="M8 10l4-3 4 3" />
    </>
  ),
  short: (
    <>
      <rect x={4} y={7} width={16} height={5} rx={0.5} opacity={0.45} />
      <rect x={4} y={12} width={16} height={8} rx={0.5} opacity={0.9} />
      <path d="M8 14l4 3 4-3" />
    </>
  ),
  measure: (
    <>
      <path d="M4 20 20 4" opacity={0.35} />
      <path d="M12 5v14M5 12h14" />
      <path d="M9.5 7.5 12 5l2.5 2.5M16.5 9.5 19 12l-2.5 2.5" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 19 19 5" />
      <path d="M11 5h8v8" />
    </>
  ),
  arrowUp: (
    <path
      d="M12 4 18.5 11H14.5V20H9.5V11H5.5Z"
      fill="currentColor"
      fillOpacity={0.25}
    />
  ),
  arrowDown: (
    <path
      d="M12 20 18.5 13H14.5V4H9.5V13H5.5Z"
      fill="currentColor"
      fillOpacity={0.25}
    />
  ),
  elliottImpulse: (
    <>
      <path d="M2.5 19 6.5 12 9 15.5 14.5 5 17 9.5 21.5 3.5" />
      <Dot cx={6.5} cy={12} />
      <Dot cx={14.5} cy={5} />
      <Dot cx={21.5} cy={3.5} />
    </>
  ),
  elliottCorrection: (
    <>
      <path d="M3 5 9.5 15 14 10 21 19.5" />
      <Dot cx={9.5} cy={15} />
      <Dot cx={14} cy={10} />
      <Dot cx={21} cy={19.5} />
    </>
  ),
  elliottTriangle: (
    <>
      <path d="M2.5 4 6.5 19 10.5 7 14 16.5 17.5 9.5 21 14" />
      <path d="M2.5 4 21 11.5M6.5 19 21 13" opacity={0.35} />
    </>
  ),
  note: (
    <>
      <path d="M5 5h14v10h-6l-4 4v-4H5z" />
      <path d="M8.5 8.5h7M8.5 11.5h4.5" />
    </>
  ),
  callout: (
    <>
      <rect x={10} y={4} width={11} height={8} rx={1.5} />
      <path d="M12.5 12 5 19" />
      <Dot cx={5} cy={19} />
    </>
  ),
  channel: (
    <>
      <path d="M3 15 17 5M7 20 21 10" />
      <path d="M5 17.5 19 7.5" strokeDasharray="2 2.5" opacity={0.5} />
      <Dot cx={3} cy={15} />
      <Dot cx={17} cy={5} />
    </>
  ),
  fibExtension: (
    <>
      <path d="M3 20 8 9 11 14" strokeDasharray="2 2.5" opacity={0.7} />
      <path d="M11 4h10M11 8h10M11 11.5h10M11 14h10" />
    </>
  ),
  fibTimeZone: (
    <>
      <path d="M4 3v18M6.5 3v18M9 3v18M12.5 3v18M18.5 3v18" />
    </>
  ),
  brush: <path d="M3 17c2.5-4 4.5-6 6.5-4s1 5 3.5 4.5S16 11 18 8s2.5-3 3-3" />,
  priceRange: (
    <>
      <path d="M5 5h14M5 19h14" />
      <path d="M12 6.5v11M9.5 9 12 6.5 14.5 9M9.5 15l2.5 2.5 2.5-2.5" />
    </>
  ),
  dateRange: (
    <>
      <path d="M5 5v14M19 5v14" />
      <path d="M6.5 12h11M9 9.5 6.5 12 9 14.5M15 9.5l2.5 2.5-2.5 2.5" />
    </>
  ),
  elliottCombo: (
    <>
      <path d="M3 6 9 16 15 9 21 19" />
      <path d="M9 16 15 9" opacity={0.45} strokeDasharray="2 2.5" />
      <Dot cx={9} cy={16} />
      <Dot cx={21} cy={19} />
    </>
  ),
};

export function ToolIcon({
  kind,
  className = "size-5",
}: {
  kind: DrawingKind;
  className?: string;
}) {
  return <Icon className={className}>{TOOL_PATHS[kind]}</Icon>;
}

export const CursorIcon = ({
  className = "size-5",
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path d="M6 4l12 7.5-5.5 1.2L10 18.5z" />
  </Icon>
);

export const MagnetIcon = ({
  className = "size-5",
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z" />
    <path d="M6 8h4M14 8h4" />
  </Icon>
);

export const LockIcon = ({
  open = false,
  className = "size-5",
}: {
  open?: boolean;
  className?: string;
}) => (
  <Icon className={className}>
    <rect x={5} y={11} width={14} height={9} rx={1.5} />
    <path
      d={open ? "M8 11V7.5a4 4 0 0 1 7.6-1.7" : "M8 11V7.5a4 4 0 0 1 8 0V11"}
    />
  </Icon>
);

export const EyeIcon = ({
  off = false,
  className = "size-5",
}: {
  off?: boolean;
  className?: string;
}) => (
  <Icon className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx={12} cy={12} r={2.75} />
    {off && <path d="M4 20 20 4" />}
  </Icon>
);
export const TrashIcon = ({ className = "size-5" }: { className?: string }) => (
  <Icon className={className}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" />
  </Icon>
);

export const UndoIcon = ({ className = "size-5" }: { className?: string }) => (
  <Icon className={className}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);

export const RedoIcon = ({ className = "size-5" }: { className?: string }) => (
  <Icon className={className}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Icon>
);

export const FullScreenIcon = ({
  className = "size-5",
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path d="M4 9V4h5" />
    <path d="M15 4h5v5" />
    <path d="M20 15v5h-5" />
    <path d="M9 20H4v-5" />
  </Icon>
);

export const ExitFullScreenIcon = ({
  className = "size-5",
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path d="M4 9h5V4" />
    <path d="M20 9h-5V4" />
    <path d="M20 15h-5v5" />
    <path d="M4 15h5v5" />
  </Icon>
);

export const IndicatorsIcon = ({
  className = "size-5",
}: {
  className?: string;
}) => (
  <Icon className={className}>
    <path d="M3 17c3-1 4.5-6 7.5-6s3.5 3.5 6 3.5S20 9 21 7" />
    <path d="M3 20.5h18" opacity={0.4} />
  </Icon>
);

export const GearIcon = ({ className = "size-5" }: { className?: string }) => (
  <Icon className={className}>
    <circle cx={12} cy={12} r={3} />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
  </Icon>
);

export const CloseIcon = ({ className = "size-5" }: { className?: string }) => (
  <Icon className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const StyleIcon = ({
  style,
  className = "size-5",
}: {
  style: ChartStyle;
  className?: string;
}) => (
  <Icon className={className}>
    {style === "candles" && (
      <>
        <path d="M8 3v3M8 15v5M16 5v4M16 17v3" />
        <rect x={5.5} y={6} width={5} height={9} rx={0.5} />
        <rect
          x={13.5}
          y={9}
          width={5}
          height={8}
          rx={0.5}
          fill="currentColor"
        />
      </>
    )}
    {style === "bars" && (
      <path d="M8 4v16M5 7h3M8 16h3M16 6v13M13 9h3M16 15h3" />
    )}
    {style === "line" && <path d="M3 17l5-6 4 3 4-7 5 4" />}
    {style === "area" && (
      <>
        <path d="M3 17l5-6 4 3 4-7 5 4" />
        <path
          d="M3 17l5-6 4 3 4-7 5 4V20H3z"
          fill="currentColor"
          opacity={0.25}
          stroke="none"
        />
      </>
    )}
  </Icon>
);
