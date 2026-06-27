// Esquemas de validación compartidos entre el cliente y el servidor.
// Este archivo NO importa de @prisma/client para que pueda ser cargado
// desde el middleware (Edge runtime) sin arrastrar el cliente de Prisma.
// Mantenerlo libre de dependencias de Prisma; si necesitas un enum,
// declara el esquema con un array literal y referencia el tipo con `import type`.
import { z } from "zod";

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
