import { Accent } from "./mining-theme";
export type InventoryCardProps = {
  label: string;
  category: string;
  description?: string | null;
  imageSrc: string;
  ownedQuantity: number;
  equippedQuantity: number;
  isExpansion: boolean;
  isEquipmentSlot: boolean;
  accent?: Accent;
};
