import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/models/Message.js', () => ({
  default: { create: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../src/services/socketService.js', () => ({
  default: { emitToConversation: vi.fn() },
}));

import MessageService from '../src/services/messageService.js';
import Message from '../src/models/Message.js';
import SocketService from '../src/services/socketService.js';

function uniqueConstraintError() {
  const err = new Error('Validation error');
  err.name = 'SequelizeUniqueConstraintError';
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MessageService — save() com unique constraint', () => {
  it('cria normalmente quando não há conflito', async () => {
    Message.create.mockResolvedValueOnce({ id: '1', created_at: new Date() });

    const result = await MessageService.save({
      conversationId: 'conv-1',
      content: 'Oi',
      role: 'user',
      messageId: 'wamid.123',
    });

    expect(result.isNew).toBe(true);
    expect(Message.findOne).not.toHaveBeenCalled();
  });

  it('reaproveita o registro existente quando o constraint é violado', async () => {
    Message.create.mockRejectedValueOnce(uniqueConstraintError());
    Message.findOne.mockResolvedValueOnce({
      id: 'existente',
      created_at: new Date(),
    });

    const result = await MessageService.save({
      conversationId: 'conv-1',
      content: 'Oi',
      role: 'user',
      messageId: 'wamid.123',
    });

    expect(result.isNew).toBe(false);
    expect(result.message.id).toBe('existente');
  });

  it('propaga outros erros que não sejam de unique constraint', async () => {
    Message.create.mockRejectedValueOnce(
      new Error('Erro de conexão com o banco')
    );

    await expect(
      MessageService.save({
        conversationId: 'conv-1',
        content: 'Oi',
        role: 'user',
      })
    ).rejects.toThrow('Erro de conexão com o banco');
  });

  it('propaga erro de unique constraint quando messageId é null (não deveria acontecer, mas por segurança)', async () => {
    Message.create.mockRejectedValueOnce(uniqueConstraintError());

    await expect(
      MessageService.save({
        conversationId: 'conv-1',
        content: 'Oi',
        role: 'user',
        messageId: null,
      })
    ).rejects.toThrow();
  });
});

describe('MessageService — saveAndEmit() só notifica quando é mensagem nova', () => {
  it('emite socket quando a mensagem é nova', async () => {
    Message.create.mockResolvedValueOnce({ id: '1', created_at: new Date() });

    await MessageService.saveAndEmit({
      conversationId: 'conv-1',
      content: 'Oi',
      role: 'user',
      messageId: 'wamid.123',
    });

    expect(SocketService.emitToConversation).toHaveBeenCalledTimes(1);
  });

  it('NÃO emite socket quando reaproveita um registro existente (evita duplicata na tela)', async () => {
    Message.create.mockRejectedValueOnce(uniqueConstraintError());
    Message.findOne.mockResolvedValueOnce({
      id: 'existente',
      created_at: new Date(),
    });

    await MessageService.saveAndEmit({
      conversationId: 'conv-1',
      content: 'Oi',
      role: 'user',
      messageId: 'wamid.123',
    });

    expect(SocketService.emitToConversation).not.toHaveBeenCalled();
  });
});
