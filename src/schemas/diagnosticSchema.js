import { z } from 'zod';

const TEAM_SIZE_OPTIONS = [
  'Apenas eu',
  '2 a 5 pessoas',
  '6 a 15 pessoas',
  'Mais de 15',
];

export const createDiagnosticSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'O nome é obrigatório.' })
      .trim()
      .min(1, 'O nome é obrigatório.')
      .max(50, 'O nome deve ter no máximo 50 caracteres.'),

    company: z
      .string({ required_error: 'O nome da empresa é obrigatório.' })
      .trim()
      .min(1, 'O nome da empresa é obrigatório.')
      .max(50, 'O nome da empresa deve ter no máximo 50 caracteres.'),

    phone: z
      .string({ required_error: 'O telefone é obrigatório.' })
      .trim()
      .min(10, 'Informe um telefone válido com DDD.')
      .max(11, 'O telefone deve ter no máximo 11 dígitos.'),

    segment: z
      .string({ required_error: 'O segmento da empresa é obrigatório.' })
      .trim()
      .min(1, 'O segmento da empresa é obrigatório.')
      .max(50, 'O segmento deve ter no máximo 50 caracteres.'),

    teamSize: z
      .enum(TEAM_SIZE_OPTIONS, {
        invalid_type_error:
          'Selecione uma opção válida para o tamanho do time.',
      })
      .optional(),

    utm: z.record(z.string()).optional(),
  }),
};
