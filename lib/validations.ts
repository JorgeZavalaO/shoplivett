// Validadores Zod centralizados.
import { z } from "zod";

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const LoginSchema = z.object({
  email: z
    .string({ message: "El correo es obligatorio." })
    .min(1, "El correo es obligatorio.")
    .email("Ingresa un correo válido."),
  password: z
    .string({ message: "La contraseña es obligatoria." })
    .min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export type LoginInput = z.infer<typeof LoginSchema>;
