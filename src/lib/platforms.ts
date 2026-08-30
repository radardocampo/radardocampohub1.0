import {
  Youtube,
  Music2,
  Instagram,
  Facebook,
  AtSign,
  Image as ImageIcon,
  Zap,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

export type PlatformId =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "pinterest"
  | "threads"
  | "facebook"
  | "kwai"
  | "shopee";

export type PlatformMeta = {
  id: PlatformId;
  name: string;
  monetized: boolean;
  icon: LucideIcon;
  /** CSS color token reference, usable in charts and inline styles */
  color: string;
  /** Tailwind text color utility built from the design system */
  textClass: string;
  bgClass: string;
};

export const PLATFORMS: PlatformMeta[] = [
  {
    id: "youtube",
    name: "YouTube",
    monetized: true,
    icon: Youtube,
    color: "var(--platform-youtube)",
    textClass: "text-youtube",
    bgClass: "bg-youtube/12",
  },
  {
    id: "tiktok",
    name: "TikTok",
    monetized: true,
    icon: Music2,
    color: "var(--platform-tiktok)",
    textClass: "text-tiktok",
    bgClass: "bg-tiktok/12",
  },
  {
    id: "instagram",
    name: "Instagram",
    monetized: false,
    icon: Instagram,
    color: "var(--platform-instagram)",
    textClass: "text-instagram",
    bgClass: "bg-instagram/12",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    monetized: false,
    icon: ImageIcon,
    color: "var(--platform-pinterest)",
    textClass: "text-pinterest",
    bgClass: "bg-pinterest/12",
  },
  {
    id: "threads",
    name: "Threads",
    monetized: false,
    icon: AtSign,
    color: "var(--platform-threads)",
    textClass: "text-threads",
    bgClass: "bg-threads/12",
  },
  {
    id: "facebook",
    name: "Facebook",
    monetized: false,
    icon: Facebook,
    color: "var(--platform-facebook)",
    textClass: "text-facebook",
    bgClass: "bg-facebook/12",
  },
  {
    id: "kwai",
    name: "Kwai",
    monetized: false,
    icon: Zap,
    color: "var(--platform-kwai)",
    textClass: "text-kwai",
    bgClass: "bg-kwai/12",
  },
  {
    id: "shopee",
    name: "Shopee",
    monetized: true,
    icon: ShoppingBag,
    color: "var(--platform-shopee)",
    textClass: "text-shopee",
    bgClass: "bg-shopee/12",
  },
];

export const CONTENT_PLATFORMS = PLATFORMS.filter((p) => p.id !== "shopee");
export const MONETIZED_PLATFORMS = PLATFORMS.filter((p) => p.monetized);

export const getPlatform = (id: string) => PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0]!;

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const formatFull = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
