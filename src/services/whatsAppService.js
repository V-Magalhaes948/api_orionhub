import axios from 'axios';

class WhatsAppService {
  #getClient(instance) {
    return {
      baseURL: process.env.EVOLUTION_BASE_URL,
      headers: {
        apikey: instance.instance_token,
        'Content-Type': 'application/json',
      },
    };
  }

  async sendText(instance, phone, message) {
    try {
      const { baseURL, headers } = this.#getClient(instance);
      const response = await axios.post(
        `${baseURL}/message/sendText/${instance.instance_id}`,
        { number: phone, text: message },
        { headers }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao enviar mensagem: ${error.message}`);
    }
  }

  async sendImage(instance, phone, imageUrl, caption = '') {
    try {
      const { baseURL, headers } = this.#getClient(instance);
      const response = await axios.post(
        `${baseURL}/message/sendMedia/${instance.instance_id}`,
        { number: phone, mediatype: 'image', media: imageUrl, caption },
        { headers }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao enviar imagem: ${error.message}`);
    }
  }

  async sendDocument(instance, phone, documentUrl, fileName) {
    try {
      const { baseURL, headers } = this.#getClient(instance);
      const response = await axios.post(
        `${baseURL}/message/sendMedia/${instance.instance_id}`,
        { number: phone, mediatype: 'document', media: documentUrl, fileName },
        { headers }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao enviar documento: ${error.message}`);
    }
  }
}

export default new WhatsAppService();
