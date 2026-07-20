import { z } from "zod";
import { BusinessSettingsSchema } from "@/lib/validations";

export type SettingsActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<
    Record<keyof z.infer<typeof BusinessSettingsSchema>, string>
  > & { paymentMethodFees?: string };
};

const initialState: SettingsActionState = { ok: false };

export const initialSettingsState: SettingsActionState = initialState;
