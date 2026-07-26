import axios from 'axios';

class GroqService {
  async generateReply(
    systemPrompt,
    userMessage,
    history = [],
    retries = 2,
    jsonMode = false
  ) {
    try {
      const formattedHistory = history.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

      const messages = [
        {
          role: 'system',
          content: systemPrompt || 'Você é um assistente prestativo.',
        },
        ...formattedHistory,
        ...(userMessage ? [{ role: 'user', content: userMessage }] : []),
      ];

      const body = {
        model: 'llama-3.3-70b-versatile',
        messages,
      };

      if (jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return (
        response.data?.choices?.[0]?.message?.content ||
        'Não consegui gerar uma resposta.'
      );
    } catch (error) {
      const isRetryable =
        error.response?.status === 503 ||
        error.response?.status === 429 ||
        ['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT'].includes(error.code);

      if (retries > 0 && isRetryable) {
        await new Promise((r) => setTimeout(r, 2000));
        return this.generateReply(
          systemPrompt,
          userMessage,
          history,
          retries - 1,
          jsonMode
        );
      }

      console.error('Groq error:', error.response?.data || error.message);
      return 'Desculpe, estou com dificuldades no momento. Tente novamente em instantes.';
    }
  }
}

export default new GroqService();
