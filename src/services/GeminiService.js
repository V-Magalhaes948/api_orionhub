import axios from 'axios';

class GeminiService {
  async generateReply(systemPrompt, userMessage, history = []) {
    try {
      // monta o histórico no formato que o Gemini espera
      const contents = history.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      // adiciona a mensagem atual do usuário
      contents.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents,
          systemInstruction: {
            parts: [
              { text: systemPrompt || 'Você é um assistente prestativo.' },
            ],
          },
        }
      );

      return (
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Não consegui gerar uma resposta.'
      );
    } catch (error) {
      console.error('Gemini error:', error.response?.data || error.message);
      return 'Desculpe, tive um problema ao processar sua mensagem.';
    }
  }
}

export default new GeminiService();
