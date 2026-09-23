import { z } from 'zod';

const TEAM_SIZE_OPTIONS = [
  'Apenas eu',
  '2 a 5 vendedores',
  '6 a 15 vendedores',
  'Mais de 15',
];

const HAS_MANUAL_SERVICE_OPTIONS = ['Sim', 'Não'];

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

    email: z
      .string({ required_error: 'O e-mail é obrigatório.' })
      .trim()
      .email('Informe um e-mail válido.'),

    phone: z
      .string({ required_error: 'O telefone é obrigatório.' })
      .trim()
      .min(11, 'O telefone é obrigatório.')
      .max(12, 'O telefone deve ter no máximo 12 caracteres.'),

    segment: z
      .string({ required_error: 'O segmento da empresa é obrigatório.' })
      .trim()
      .min(1, 'O segmento da empresa é obrigatório.')
      .max(50, 'O segmento deve ter no máximo 50 caracteres.'),

    hasManualService: z.enum(HAS_MANUAL_SERVICE_OPTIONS, {
      required_error: 'Informe se a empresa faz atendimentos manuais.',
      invalid_type_error: 'Selecione uma opção válida para atendimento manual.',
    }),

    teamSize: z
      .enum(TEAM_SIZE_OPTIONS, {
        invalid_type_error:
          'Selecione uma opção válida para o tamanho do time.',
      })
      .optional(),
  }),
};
